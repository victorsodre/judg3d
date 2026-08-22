import { useId, useRef, useState, type DragEvent, type ChangeEvent } from "react";

type DropZoneProps = {
  file: File | null;
  disabled: boolean;
  onFile: (file: File | null) => void;
};

export function DropZone({ file, disabled, onFile }: DropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hot, setHot] = useState(false);

  function accept(next: File | null): void {
    if (disabled) {
      return;
    }
    onFile(next);
  }

  function onDragOver(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    if (!disabled) {
      setHot(true);
    }
  }

  function onDragLeave(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setHot(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setHot(false);
    const dropped = event.dataTransfer.files.item(0);
    if (dropped !== null) {
      accept(dropped);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>): void {
    const picked = event.target.files?.item(0) ?? null;
    accept(picked);
  }

  return (
    <label
      htmlFor={inputId}
      className={`dropzone${hot ? " dropzone--hot" : ""}${file ? " dropzone--ready" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        disabled={disabled}
        onChange={onChange}
      />
      <span className="dropzone__eyebrow">asset</span>
      {file === null ? (
        <>
          <strong className="dropzone__title">Solte o GLB aqui</strong>
          <span className="dropzone__hint">
            ou clique para escolher · .glb / .gltf
          </span>
        </>
      ) : (
        <>
          <strong className="dropzone__title">{file.name}</strong>
          <span className="dropzone__hint">
            {(file.size / 1024).toFixed(1)} KB · clique para trocar
          </span>
        </>
      )}
    </label>
  );
}
