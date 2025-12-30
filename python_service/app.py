from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import akshare as ak
import pandas as pd
import warnings
import concurrent.futures
import time
from datetime import datetime, timedelta

warnings.filterwarnings("ignore")

app = FastAPI()


class AnalyzeRequest(BaseModel):
    strategy: str
    symbols: str
    notes: Optional[str] = None


N = 4
M = 120
P = 30
PRICE_RANGE = 1.05
LONG_RAISE = 1.05
TURBULENCE = 1.03

NEEDED_DAYS = M + 5
TODAY = datetime.now().strftime("%Y%m%d")
CALENDAR_DAYS_NEEDED = int(NEEDED_DAYS * 1.8)
START_DATE = (datetime.now() - timedelta(days=CALENDAR_DAYS_NEEDED)).strftime(
    "%Y%m%d"
)

MAX_WORKERS = 8
TIMEOUT = 5


def parse_symbols(raw: str) -> List[str]:
    cleaned = raw.replace(",", " ").replace("\n", " ")
    return [item.strip() for item in cleaned.split(" ") if item.strip()]


def get_minimal_stock_data(stock_code: str) -> pd.DataFrame:
    try:
        df = ak.stock_zh_a_hist(
            symbol=stock_code,
            period="daily",
            start_date=START_DATE,
            end_date=TODAY,
            adjust="qfq",
            timeout=TIMEOUT,
        )
        if df.empty or len(df) < M + 5:
            return pd.DataFrame()

        df = df[["日期", "开盘", "最高", "最低", "收盘", "成交量"]]
        df.columns = ["date", "open", "high", "low", "close", "volume"]
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)
        if len(df) < M + 5:
            return pd.DataFrame()
        return df
    except Exception:
        return pd.DataFrame()


def calculate_indicators_exact(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    if df is None or len(df) < M + 5:
        return None

    df = df.copy()
    df["最低价_M"] = df["low"].rolling(window=M, min_periods=M).min()
    df["相对底部"] = df["low"] <= df["最低价_M"] * PRICE_RANGE
    df["HHV_H_P"] = df["high"].rolling(window=P, min_periods=P).max()
    df["LLV_L_P"] = df["low"].rolling(window=P, min_periods=P).min()
    df["震荡幅度计算"] = (df["HHV_H_P"] - df["LLV_L_P"]) / df["LLV_L_P"] * 100
    df["震荡幅度达标"] = df["震荡幅度计算"] <= P
    df["底部位置"] = df["相对底部"] | df["震荡幅度达标"]
    df["涨幅"] = df["close"] / df["close"].shift(1)
    df["长阳"] = (df["涨幅"] > LONG_RAISE) & (df["close"] > df["open"])
    df["前3日最高价"] = df["high"].shift(1).rolling(window=3, min_periods=3).max()
    df["前3日最低价"] = df["low"].shift(1).rolling(window=3, min_periods=3).min()
    df["前3日震荡幅度"] = df["前3日最高价"] / df["前3日最低价"]
    df["突兀"] = df["前3日震荡幅度"] < TURBULENCE
    df["倍量"] = df["volume"] / df["volume"].shift(1) >= N
    df["底部暴力K线"] = (
        df["底部位置"] & df["长阳"] & df["突兀"] & df["倍量"]
    )
    return df


def evaluate_symbol(code: str) -> Optional[dict]:
    df = get_minimal_stock_data(code)
    if df.empty:
        return None
    df_with = calculate_indicators_exact(df)
    if df_with is None or len(df_with) < 2:
        return None

    latest = df_with.iloc[-1]
    if not latest.get("底部暴力K线", False):
        return None

    volume_ratio = round(
        df_with.iloc[-1]["volume"] / df_with.iloc[-2]["volume"], 2
    )

    return {
        "symbol": code,
        "date": latest["date"].strftime("%Y-%m-%d"),
        "close": round(latest["close"], 2),
        "change_pct": round((latest["涨幅"] - 1) * 100, 2),
        "volume_ratio": volume_ratio,
        "turbulence_pct": round(latest["震荡幅度计算"], 2),
        "min_price_m": round(latest["最低价_M"], 2),
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    symbols = parse_symbols(request.symbols)
    if not symbols:
        return {"matches": [], "stats": {"total": 0, "matched": 0}}

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for item in executor.map(evaluate_symbol, symbols):
            if item:
                results.append(item)

    stats = {
        "total": len(symbols),
        "matched": len(results),
    }

    return {
        "strategy": request.strategy,
        "matches": results,
        "stats": stats,
    }
