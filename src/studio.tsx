import { useState, useEffect, useContext } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowRight,
  Heart,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Star,
  Columns2,
  Pencil,
  Check,
} from "lucide-react";
import { api, media } from "./api";
import {
  Page,
  Modal,
  Empty,
  ActionForm,
  Field,
  NoteField,
  Select,
  Loading,
  Failure,
  useNotice,
  Confirm,
} from "./ui";
import { client, User } from "./main";

export function StudioList() {
  const drafts = useQuery({
    queryKey: ["drafts"],
    queryFn: () => api("/drafts"),
  });
  const [create, setCreate] = useState(false);
  const navigate = useNavigate();
  return (
    <Page
      title="Our Studio"
      action={
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={17} /> New post
        </button>
      }
    >
      {drafts.isPending ? (
        <Loading />
      ) : drafts.error ? (
        <Failure error={drafts.error} retry={() => drafts.refetch()} />
      ) : !drafts.data.length ? (
        <Empty
          title="No posts yet"
          body="Choose some photos to start."
          action={<button onClick={() => setCreate(true)}>New post</button>}
        />
      ) : (
        <div className="album-grid">
          {drafts.data.map((draft: any) => (
            <Link
              to={"/studio/" + draft.id}
              className="draft-card"
              key={draft.id}
            >
              <div className="album-cover">
                {draft.cover ? (
                  <img src={media(draft.cover)} alt="" />
                ) : (
                  <Heart size={38} />
                )}
                {draft.status === "posted" && (
                  <span className="badge">Posted</span>
                )}
              </div>
              <h2>{draft.title}</h2>
              <p>{draft.count} photos</p>
            </Link>
          ))}
        </div>
      )}
      {create && (
        <Modal title="New post" onClose={() => setCreate(false)}>
          <ActionForm
            submit="Create post"
            onSubmit={async (data) => {
              const draft = await api("/drafts", "POST", data);
              client.invalidateQueries({ queryKey: ["drafts"] });
              navigate("/studio/" + draft.id);
            }}
          >
            <Field label="Title" name="title" required />
            <NoteField label="Notes (optional)" name="notes" rows={3} />
          </ActionForm>
        </Modal>
      )}
    </Page>
  );
}
export function StudioEditor() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["draft", id],
    queryFn: () => api("/drafts/" + id),
    refetchInterval: 15000,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return <Failure error={query.error} retry={() => query.refetch()} />;
  return (
    <Editor key={id} initial={query.data} refresh={() => query.refetch()} />
  );
}
function Editor({ initial, refresh }: { initial: any; refresh: () => any }) {
  const navigate = useNavigate(),
    user = useContext(User),
    notice = useNotice();
  const [edit, setEdit] = useState(initial),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState(false),
    [position, setPosition] = useState(0),
    [download, setDownload] = useState(false),
    [renaming, setRenaming] = useState(false);
  const [job, setJob] = useState<string | null>(null),
    [leaving, setLeaving] = useState<string | null>(null),
    [reloading, setReloading] = useState(false),
    [comparing, setComparing] = useState(false);
  const exp = useQuery({
    queryKey: ["export", job],
    queryFn: () => api("/exports/" + job),
    enabled: !!job,
    refetchInterval: (q) =>
      ["pending", "processing"].includes(q.state.data?.state) ? 2000 : false,
  });
  useEffect(() => {
    if (!dirty) setEdit(initial);
  }, [initial]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!dirty || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const link = (event.target as HTMLElement).closest("a");
      if (
        !link ||
        link.target === "_blank" ||
        link.origin !== location.origin ||
        link.pathname.startsWith("/api/")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving(link.pathname + link.search);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [dirty]);
  function change(key: string, value: any) {
    setEdit((current: any) => ({ ...current, [key]: value }));
    setDirty(true);
    setError("");
    setJob(null);
  }
  function reorder(from: number, to: number) {
    if (
      from < 0 ||
      from >= edit.photos.length ||
      to < 0 ||
      to >= edit.photos.length
    )
      return;
    const photos = [...edit.photos];
    const [moved] = photos.splice(from, 1);
    photos.splice(to, 0, moved);
    change("photos", photos);
  }
  async function persist(overrides: Record<string, unknown> = {}) {
    if (saving) return false;
    setSaving(true);
    setError("");
    try {
      const value = await api("/drafts/" + edit.id, "PUT", {
        version: edit.version,
        title: edit.title,
        notes: edit.notes,
        caption: edit.caption,
        hashtags: edit.hashtags,
        ratio: edit.ratio,
        fit: edit.fit,
        photos: edit.photos.map((photo: any) => photo.id),
        status: edit.status,
        post_url: edit.post_url,
        ...overrides,
      });
      setEdit((current: any) => ({ ...current, ...value }));
      setDirty(false);
      await refresh();
      client.invalidateQueries({ queryKey: ["drafts"] });
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function prepare() {
    if (dirty && !(await persist())) return;
    try {
      setJob((await api("/drafts/" + edit.id + "/exports", "POST")).id);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      notice(label + " copied.");
    } catch {
      notice("Select the text and copy it manually.");
    }
  }
  const candidates = [
    ...new Map(
      [...initial.suggestions, ...edit.photos].map((photo: any) => [
        photo.photo_id || photo.id,
        photo,
      ]),
    ).values(),
  ];
  return (
    <Page
      title={edit.title}
      action={
        <div className="row">
          <button
            className="icon"
            aria-label="Edit post title"
            onClick={() => setRenaming(true)}
          >
            <Pencil size={17} />
          </button>
          <button
            onClick={() => setPreview(true)}
            disabled={!edit.photos.length}
          >
            Preview
          </button>
          <button
            className="primary"
            disabled={!dirty || saving}
            onClick={async () => {
              if (await persist()) notice("Saved.");
            }}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      }
    >
      <div className="studio-status">
        <span>
          {dirty ? "Unsaved changes" : edit.status === "posted" ? "Posted" : ""}
        </span>
        <Link to="/memories">
          Add photos <Plus size={15} />
        </Link>
      </div>
      {initial.version !== edit.version && dirty && (
        <div className="error-panel">
          There are newer changes. Your edits are still here.{" "}
          <button onClick={() => setReloading(true)}>
            View latest version
          </button>
        </div>
      )}
      {error && (
        <div className="error-panel" role="alert">
          {error}
        </div>
      )}
      <div className="studio-layout studio-layout-simple">
        <section className="studio-main">
          <div className="section-title">
            <h2>Selected photos</h2>
            <span>{edit.photos.length}</span>
          </div>
          {!edit.photos.length ? (
            <div className="studio-empty">
              <Heart size={26} />
              <p>No photos selected</p>
              <Link to="/memories">
                Choose photos <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="carousel-tray">
              {edit.photos.map((photo: any, index: number) => (
                <article
                  className="carousel-item"
                  key={photo.id}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/plain", String(index))
                  }
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = Number(
                      event.dataTransfer.getData("text/plain"),
                    );
                    if (Number.isInteger(from)) reorder(from, index);
                  }}
                >
                  <div className="carousel-image">
                    <img src={media(photo.id)} alt={photo.filename} />
                    <span>
                      {String(index + 1).padStart(2, "0")}
                      {index === 0 ? " · Cover" : ""}
                    </span>
                  </div>
                  {photo.deleted_at && (
                    <strong className="form-error">In Trash</strong>
                  )}
                  <div className="row">
                    <button
                      className="icon"
                      aria-label={"Move photo " + (index + 1) + " earlier"}
                      disabled={index === 0}
                      onClick={() => reorder(index, index - 1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      className="icon"
                      aria-label={"Move photo " + (index + 1) + " later"}
                      disabled={index === edit.photos.length - 1}
                      onClick={() => reorder(index, index + 1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                    <button
                      className="icon"
                      aria-label={"Make photo " + (index + 1) + " cover"}
                      title="Set as cover"
                      disabled={index === 0}
                      onClick={() => reorder(index, 0)}
                    >
                      <Star size={16} />
                    </button>
                    <button
                      className="icon"
                      aria-label={"Remove photo " + (index + 1)}
                      onClick={() =>
                        change(
                          "photos",
                          edit.photos.filter((p: any) => p.id !== photo.id),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="section-title">
            <h2>Maybe these?</h2>
            {candidates.length >= 2 && (
              <button onClick={() => setComparing(true)}>
                <Columns2 size={16} /> Compare
              </button>
            )}
          </div>
          {!initial.suggestions.length ? (
            <p className="quiet-note">
              Photos added from Memories will appear here.
            </p>
          ) : (
            <div className="suggestions">
              {initial.suggestions.map((suggestion: any) => (
                <article key={suggestion.photo_id + suggestion.user_id}>
                  <img
                    src={media(suggestion.photo_id)}
                    alt={suggestion.filename}
                    loading="lazy"
                  />
                  <div>
                    <strong>{suggestion.name}’s pick</strong>
                    <small>{suggestion.filename}</small>
                    <button
                      disabled={
                        suggestion.deleted_at ||
                        suggestion.status !== "ready" ||
                        edit.photos.some(
                          (photo: any) => photo.id === suggestion.photo_id,
                        )
                      }
                      onClick={() =>
                        change("photos", [
                          ...edit.photos,
                          {
                            id: suggestion.photo_id,
                            filename: suggestion.filename,
                            status: suggestion.status,
                          },
                        ])
                      }
                    >
                      {edit.photos.some(
                        (photo: any) => photo.id === suggestion.photo_id,
                      )
                        ? "Selected"
                        : "Add to carousel"}
                    </button>
                    {suggestion.user_id === user.id && (
                      <button
                        className="ghost"
                        onClick={async () => {
                          try {
                            await api(
                              "/drafts/" +
                                edit.id +
                                "/suggestions/" +
                                suggestion.photo_id,
                              "DELETE",
                            );
                            refresh();
                          } catch (error) {
                            notice((error as Error).message);
                          }
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <section className="post-notes">
            <NoteField
              label="Notes"
              value={edit.notes}
              onChange={(event) => change("notes", event.target.value)}
              rows={4}
            />
          </section>
        </section>
        <aside className="studio-side">
          <section className="panel caption-panel">
            <h2>Caption</h2>
            <NoteField
              label="Caption"
              value={edit.caption}
              onChange={(event) => change("caption", event.target.value)}
              rows={7}
            />
            <div className="caption-meta">
              <small>{edit.caption.length} characters</small>
              <button
                className="ghost"
                onClick={() => copy(edit.caption, "Caption")}
              >
                Copy caption
              </button>
            </div>
            <details open={!!edit.hashtags}>
              <summary>Hashtags</summary>
              <NoteField
                label="Hashtags"
                value={edit.hashtags}
                onChange={(event) => change("hashtags", event.target.value)}
                rows={2}
              />
              <button onClick={() => copy(edit.hashtags, "Hashtags")}>
                Copy hashtags
              </button>
            </details>
            <details>
              <summary>Other captions ({initial.captions.length})</summary>
              {initial.captions.map((caption: any) => (
                <div className="comment" key={caption.id}>
                  <strong>{caption.name}</strong>
                  <p>{caption.body}</p>
                  <button onClick={() => change("caption", caption.body)}>
                    Use caption
                  </button>
                </div>
              ))}
              <ActionForm
                submit="Add caption"
                onSubmit={async (data) => {
                  await api("/drafts/" + edit.id + "/captions", "POST", data);
                  refresh();
                }}
              >
                <NoteField label="Caption idea" name="body" rows={3} />
              </ActionForm>
            </details>
          </section>
          <section className="post-download">
            <button
              className="primary"
              disabled={!edit.photos.length || saving}
              onClick={() => setDownload(true)}
            >
              <Download size={17} /> Download photos
            </button>
            <button
              className="ghost"
              disabled={saving}
              onClick={async () => {
                if (
                  await persist({
                    status: edit.status === "posted" ? "collecting" : "posted",
                  })
                )
                  notice(
                    edit.status === "posted"
                      ? "Moved back to drafts."
                      : "Marked as posted.",
                  );
              }}
            >
              <Check size={15} />
              {edit.status === "posted"
                ? "Move back to drafts"
                : "Mark as posted"}
            </button>
          </section>
          <section className="panel">
            <h2>Comments</h2>
            {initial.comments.map((comment: any) => (
              <div className="comment" key={comment.id}>
                <strong>{comment.name}</strong>
                {comment.photo_id && <small>On a photo</small>}
                <p>{comment.body}</p>
              </div>
            ))}
            <ActionForm
              submit="Send"
              onSubmit={async (data) => {
                await api("/drafts/" + edit.id + "/comments", "POST", {
                  ...data,
                  photo_id: data.photo_id || null,
                });
                refresh();
              }}
            >
              <NoteField label="Leave a note" name="body" rows={3} />
              {edit.photos.length > 0 && (
                <Select label="About" name="photo_id">
                  <option value="">This post</option>
                  {edit.photos.map((photo: any) => (
                    <option key={photo.id} value={photo.id}>
                      {photo.filename}
                    </option>
                  ))}
                </Select>
              )}
            </ActionForm>
          </section>
        </aside>
      </div>
      {renaming && (
        <Modal title="Edit title" onClose={() => setRenaming(false)}>
          <ActionForm
            submit="Save title"
            onSubmit={async (data) => {
              if (await persist({ title: data.title })) setRenaming(false);
            }}
          >
            <Field
              label="Title"
              name="title"
              defaultValue={edit.title}
              required
            />
          </ActionForm>
        </Modal>
      )}
      {download && (
        <Modal title="Download photos" onClose={() => setDownload(false)}>
          <p>{edit.photos.length} photos in your chosen order.</p>
          <details>
            <summary>Size & borders</summary>
            <Select
              label="Photo size"
              value={edit.ratio}
              onChange={(event: any) => change("ratio", event.target.value)}
            >
              <option value="4:5">Portrait · 4:5</option>
              <option value="3:4">Tall portrait · 3:4</option>
              <option value="1:1">Square · 1:1</option>
              <option value="1.91:1">Landscape · 1.91:1</option>
            </Select>
            <Select
              label="Borders"
              value={edit.fit}
              onChange={(event: any) => change("fit", event.target.value)}
            >
              <option value="contain">Keep the whole photo</option>
              <option value="cover">Crop to fill</option>
            </Select>
          </details>
          <div className="row actions">
            <button
              className="primary"
              disabled={saving || (exp.isFetching && !!job)}
              onClick={prepare}
            >
              {saving ? "Saving…" : "Prepare download"}
            </button>
            {exp.data?.state === "completed" && (
              <a className="button" href={"/api/exports/" + job + "/download"}>
                Download ZIP
              </a>
            )}
          </div>
          <div role="status">
            {job &&
              ["pending", "processing"].includes(
                exp.data?.state || "pending",
              ) && <p>Preparing photos…</p>}
            {exp.data?.state === "failed" && <p>{exp.data.error}</p>}
            {exp.error && <p>{exp.error.message}</p>}
          </div>
        </Modal>
      )}
      {preview && (
        <Modal title="Preview" onClose={() => setPreview(false)}>
          <div className="instagram-preview">
            <div
              style={{
                aspectRatio: edit.ratio.replace(":", "/"),
                background: "white",
              }}
            >
              <img
                src={media(
                  edit.photos[Math.min(position, edit.photos.length - 1)].id,
                  "preview",
                )}
                alt="Carousel preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: edit.fit === "cover" ? "cover" : "contain",
                }}
              />
            </div>
            <div className="row">
              <button
                className="icon"
                aria-label="Previous carousel slide"
                disabled={position === 0}
                onClick={() => setPosition(position - 1)}
              >
                <ChevronLeft />
              </button>
              <span>
                {position + 1} / {edit.photos.length}
              </span>
              <button
                className="icon"
                aria-label="Next carousel slide"
                disabled={position === edit.photos.length - 1}
                onClick={() => setPosition(position + 1)}
              >
                <ChevronRight />
              </button>
            </div>
            <p>{edit.caption}</p>
            <small>{edit.hashtags}</small>
          </div>
        </Modal>
      )}
      {reloading && (
        <Confirm
          title="Load the latest changes?"
          body="Your unsaved edits will be discarded."
          action="Load latest changes"
          onClose={() => setReloading(false)}
          onConfirm={async () => {
            setEdit(initial);
            setDirty(false);
          }}
        />
      )}
      {leaving && (
        <Confirm
          title="Leave without saving?"
          body="Your unsaved edits will be discarded."
          action="Leave without saving"
          onClose={() => setLeaving(null)}
          onConfirm={async () => {
            setDirty(false);
            navigate(leaving);
          }}
        />
      )}
      {comparing && (
        <CompareModal
          candidates={candidates}
          carouselIds={edit.photos.map((photo: any) => photo.id)}
          onAdd={(photo) => change("photos", [...edit.photos, photo])}
          onClose={() => setComparing(false)}
        />
      )}
    </Page>
  );
}
function CompareModal({
  candidates,
  carouselIds,
  onAdd,
  onClose,
}: {
  candidates: any[];
  carouselIds: string[];
  onAdd: (photo: any) => void;
  onClose: () => void;
}) {
  const [firstId, setFirstId] = useState(
    candidates[0]?.photo_id || candidates[0]?.id || "",
  );
  const [secondId, setSecondId] = useState(
    candidates[1]?.photo_id || candidates[1]?.id || "",
  );
  const first = candidates.find((c) => (c.photo_id || c.id) === firstId);
  const second = candidates.find((c) => (c.photo_id || c.id) === secondId);

  return (
    <Modal title="Compare photos" onClose={onClose} wide>
      <div className="compare-grid">
        <div className="compare-card">
          <Select
            label="First photo"
            value={firstId}
            onChange={(e: any) => setFirstId(e.target.value)}
          >
            {candidates.map((c) => {
              const id = c.photo_id || c.id;
              return (
                <option key={`a-${id}`} value={id}>
                  {c.filename} {c.name ? `(${c.name}'s pick)` : ""}
                </option>
              );
            })}
          </Select>
          {first && (
            <>
              <img
                src={media(first.photo_id || first.id, "preview")}
                alt={first.filename}
              />
              <dl>
                <div className="detail-pair">
                  <dt>Filename</dt>
                  <dd>{first.filename}</dd>
                </div>
                {first.name && (
                  <div className="detail-pair">
                    <dt>Suggested by</dt>
                    <dd>{first.name}</dd>
                  </div>
                )}
              </dl>
              <button
                className="primary"
                disabled={carouselIds.includes(first.photo_id || first.id)}
                onClick={() => {
                  onAdd({
                    id: first.photo_id || first.id,
                    filename: first.filename,
                    status: first.status,
                  });
                }}
              >
                {carouselIds.includes(first.photo_id || first.id)
                  ? "Already in carousel"
                  : "Add to carousel"}
              </button>
            </>
          )}
        </div>
        <div className="compare-card">
          <Select
            label="Second photo"
            value={secondId}
            onChange={(e: any) => setSecondId(e.target.value)}
          >
            {candidates.map((c) => {
              const id = c.photo_id || c.id;
              return (
                <option key={`b-${id}`} value={id}>
                  {c.filename} {c.name ? `(${c.name}'s pick)` : ""}
                </option>
              );
            })}
          </Select>
          {second && (
            <>
              <img
                src={media(second.photo_id || second.id, "preview")}
                alt={second.filename}
              />
              <dl>
                <div className="detail-pair">
                  <dt>Filename</dt>
                  <dd>{second.filename}</dd>
                </div>
                {second.name && (
                  <div className="detail-pair">
                    <dt>Suggested by</dt>
                    <dd>{second.name}</dd>
                  </div>
                )}
              </dl>
              <button
                className="primary"
                disabled={carouselIds.includes(second.photo_id || second.id)}
                onClick={() => {
                  onAdd({
                    id: second.photo_id || second.id,
                    filename: second.filename,
                    status: second.status,
                  });
                }}
              >
                {carouselIds.includes(second.photo_id || second.id)
                  ? "Already in carousel"
                  : "Add to carousel"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
