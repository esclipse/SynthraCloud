'use client';

import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-50 animate-pulse rounded-lg" />,
});

interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export default function Editor({
  value,
  onChange,
  readOnly = false,
  placeholder,
}: EditorProps) {
  const modules = {
    toolbar: readOnly
      ? false
      : [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
  };

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'list',
    'link',
    'image',
  ];

  return (
    <div className={`rich-text-editor ${readOnly ? 'read-only' : ''}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        readOnly={readOnly}
        placeholder={placeholder}
        className={readOnly ? 'bg-gray-50' : 'bg-white'}
      />
    </div>
  );
}
