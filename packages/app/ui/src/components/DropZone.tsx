import { useLocale } from "../locale.js";
import { formatBytes } from "@judg3d/core/present";
import { useId, useState, type DragEvent, type ChangeEvent } from "react";

type DropZoneProps = {
  file: File | null;
  disabled: boolean;
  onFile: (file: File | null) => void;
};

export function DropZone({ file, disabled, onFile }: DropZoneProps) {
  const { locale, t } = useLocale();
  const inputId = useId();
  const [error, setError] = useState(false);
  const [hot, setHot] = useState(false);

  function accept(next: File | null): void {
    if (disabled) {
      return;
    }
    if (next !== null && next.size > 64 * 1024 * 1024) {
      setError(true);
      onFile(null);
      return;
    }
    setError(false);
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
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        disabled={disabled}
        onChange={onChange}
      />
      <span className="dropzone__eyebrow">{t.asset}</span>
      {file === null ? (
        <>
          <strong className="dropzone__title">{t.dropTitle}</strong>
          <span className="dropzone__hint">{t.dropHint}</span>
        </>
      ) : (
        <>
          <strong className="dropzone__title">{file.name}</strong>
          <span className="dropzone__hint">
            {formatBytes(file.size, locale)} · {t.changeFile}
          </span>
        </>
      )}
      {!error ? null : (
        <span role="alert" className="dropzone__error">
          {t.fileTooLarge}
        </span>
      )}
    </label>
  );
}
