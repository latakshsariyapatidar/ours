import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, Check, X } from "lucide-react";
import { api, csrf, bytes } from "./api";
import { Modal, Select } from "./ui";
import { client } from "./main";
type Item = {
  key: string;
  file: File;
  state: string;
  progress: number;
  id?: string;
  error?: string;
  cancel?: boolean;
};
export function UploadManager({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]),
    [running, setRunning] = useState(false),
    [album, setAlbum] = useState("");
  const queue = useRef<Item[]>([]);
  const albums = useQuery({
    queryKey: ["albums"],
    queryFn: () => api("/albums"),
  });
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api("/system"),
  });
  const update = () => setItems([...queue.current]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        queue.current.some((i) => ["Waiting", "Uploading"].includes(i.state))
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  async function run() {
    if (running) return;
    setRunning(true);
    for (const item of queue.current) {
      if (!["Waiting", "Failed"].includes(item.state) || item.cancel) continue;
      try {
        item.state = "Uploading";
        item.error = "";
        update();
        if (item.file.size > (system.data?.maxUploadBytes || 52428800))
          throw new Error("File exceeds the upload size limit.");
        if (!item.id)
          item.id = (
            await api("/uploads", "POST", {
              filename: item.file.name,
              size: item.file.size,
            })
          ).id;
        let offset = Number((await api(`/uploads/${item.id}`)).offset_bytes);
        while (offset < item.file.size && !item.cancel) {
          const chunk = item.file.slice(offset, offset + 1024 * 1024);
          let success = false;
          for (let attempt = 0; attempt < 3 && !success; attempt++) {
            try {
              const res = await fetch(`/api/uploads/${item.id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/octet-stream",
                  "X-CSRF-Token": csrf,
                  "Upload-Offset": String(offset),
                },
                body: chunk,
                signal: AbortSignal.timeout(90000),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              offset = data.offset;
              success = true;
            } catch (e) {
              const server = await api(`/uploads/${item.id}`).catch(() => null);
              if (server && Number(server.offset_bytes) > offset) {
                offset = Number(server.offset_bytes);
                success = true;
              } else if (attempt === 2) throw e;
              else
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
          }
          item.progress = Math.round((offset / item.file.size) * 100);
          update();
        }
        if (item.cancel) {
          await api(`/uploads/${item.id}`, "DELETE");
          item.state = "Cancelled";
        } else {
          const result = await api(`/uploads/${item.id}/complete`, "POST");
          if (album)
            await api(`/albums/${album}/photos`, "PUT", {
              ids: [result.photoId],
            });
          item.state = result.duplicate
            ? "Already in your library"
            : "Uploaded · preparing previews";
        }
      } catch (e) {
        item.state = "Failed";
        item.error = (e as Error).message;
      }
      update();
    }
    setRunning(false);
    client.invalidateQueries({ queryKey: ["photos"] });
  }
  function add(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 200))
      queue.current.push({
        key: crypto.randomUUID(),
        file,
        state: "Waiting",
        progress: 0,
      });
    update();
  }
  return (
    <Modal
      title="A few more memories"
      onClose={() => {
        if (!running) onClose();
      }}
      wide
    >
      <p>
        Keep this page open while uploading. Originals are kept exactly as you
        give them to us.
      </p>
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!running) add(e.dataTransfer.files);
        }}
      >
        <Upload size={32} />
        <h3>Little moments belong here.</h3>
        <p>Drop your photos, or choose them from your gallery.</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,.heic,.heif"
          multiple
          onChange={(e) => add(e.target.files)}
          hidden
        />
        <button onClick={() => input.current?.click()} disabled={running}>
          Choose photographs
        </button>
        <small>
          JPEG, PNG, WebP, HEIC, AVIF & GIF ·{" "}
          {bytes(system.data?.maxUploadBytes || 52428800)} each
        </small>
      </div>
      <Select
        label="Add to an album (optional)"
        value={album}
        onChange={(e: any) => setAlbum(e.target.value)}
        disabled={running}
      >
        <option value="">Just our memories</option>
        {albums.data?.map((a: any) => (
          <option key={a.id} value={a.id}>
            {a.title}
          </option>
        ))}
      </Select>
      {!!items.length && (
        <>
          <p>
            {items.filter((i) => i.progress === 100).length} of {items.length}{" "}
            transferred
          </p>
          <progress
            max={items.length * 100}
            value={items.reduce((n, i) => n + i.progress, 0)}
            aria-label="Overall upload progress"
          />
        </>
      )}
      <div className="upload-list">
        {items.map((item) => (
          <div className="upload-row" key={item.key}>
            <div>
              <strong>{item.file.name}</strong>
              <small>
                {item.state}
                {item.error && ` · ${item.error}`}
              </small>
              <progress
                max={100}
                value={item.progress}
                aria-label={`${item.file.name} progress`}
              />
            </div>
            {item.progress === 100 ? (
              <Check />
            ) : (
              <button
                className="icon"
                aria-label={`Cancel ${item.file.name}`}
                onClick={() => {
                  item.cancel = true;
                  item.state = "Cancelled";
                  update();
                }}
              >
                <X size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="row actions">
        <button
          className="primary"
          disabled={
            running ||
            !items.some((i) => ["Waiting", "Failed"].includes(i.state))
          }
          onClick={run}
        >
          {running
            ? "Uploading…"
            : items.some((i) => i.state === "Failed")
              ? "Retry failed uploads"
              : "Upload photographs"}
        </button>
        <button disabled={running} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
