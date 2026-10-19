import { useState, useEffect, useContext } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  Check,
  Heart,
  Download,
  Music,
  ChevronLeft,
  ChevronRight,
  X,
  Star,
  Columns2,
} from "lucide-react";
import { api, media, status } from "./api";
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
  const nav = useNavigate();
  return (
    <Page
      eyebrow="MADE BY THE TWO OF US"
      title="Our Studio."
      description="The choosing, the little debates, the perfect words. This part is ours."
      action={
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={17} /> Start a post
        </button>
      }
    >
      {drafts.isPending ? (
        <Loading />
      ) : drafts.error ? (
        <Failure error={drafts.error} retry={() => drafts.refetch()} />
      ) : !drafts.data.length ? (
        <Empty
          title="Let’s make something together."
          body="Start with a handful of favourites. Leave each other little notes. Find the post that feels like us."
          action={
            <button className="primary" onClick={() => setCreate(true)}>
              Our first post <ArrowRight size={16} />
            </button>
          }
        />
      ) : (
        <div className="album-grid">
          {drafts.data.map((d: any) => (
            <Link to={`/studio/${d.id}`} className="draft-card" key={d.id}>
              <div className="album-cover">
                {d.cover ? (
                  <img src={media(d.cover)} alt="" />
                ) : (
                  <Heart size={44} />
                )}
                <span className="badge">{status(d.status)}</span>
              </div>
              <h2>{d.title}</h2>
              <p>
                {d.count} photographs <span>·</span> Open our workspace{" "}
                <ArrowRight size={15} />
              </p>
            </Link>
          ))}
        </div>
      )}
      {create && (
        <Modal title="Something worth sharing" onClose={() => setCreate(false)}>
          <ActionForm
            submit="Create our draft"
            onSubmit={async (data) => {
              const d = await api("/drafts", "POST", data);
              client.invalidateQueries({ queryKey: ["drafts"] });
              nav(`/studio/${d.id}`);
            }}
          >
            <Field
              label="Give our post a title"
              name="title"
              placeholder="That weekend by the sea"
              required
            />
            <NoteField label="A little note to start with" name="notes" />
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
    queryFn: () => api(`/drafts/${id}`),
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
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState<string | null>(null);
  const [edit, setEdit] = useState(initial),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [position, setPosition] = useState(0),
    [job, setJob] = useState<string | null>(null),
    [reloading, setReloading] = useState(false),
    [comparing, setComparing] = useState(false);
  const user = useContext(User),
    notice = useNotice();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api("/users") });
  const exp = useQuery({
    queryKey: ["export", job],
    queryFn: () => api(`/exports/${job}`),
    enabled: !!job,
    refetchInterval: (q) =>
      ["pending", "processing"].includes(q.state.data?.state) ? 2000 : false,
  });
  useEffect(() => {
    if (!dirty) setEdit(initial);
  }, [initial]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
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
    setEdit((d: any) => ({ ...d, [key]: value }));
    setDirty(true);
    setError("");
  }
  function reorder(from: number, to: number) {
    if (to < 0 || to >= edit.photos.length) return;
    const items = [...edit.photos];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    change("photos", items);
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      await api(`/drafts/${edit.id}`, "PUT", {
        version: edit.version,
        title: edit.title,
        notes: edit.notes,
        caption: edit.caption,
        hashtags: edit.hashtags,
        ratio: edit.ratio,
        fit: edit.fit,
        photos: edit.photos.map((p: any) => p.id),
        status: edit.status,
        post_url: edit.post_url,
      });
      setDirty(false);
      await refresh();
      client.invalidateQueries({ queryKey: ["drafts"] });
      notice("Saved for both of you.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function approve() {
    try {
      await api(`/drafts/${edit.id}/approve`, "POST", {
        version: edit.version,
      });
      await refresh();
      notice("Your approval is saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Page
      eyebrow="OUR SHARED WORKSPACE"
      title={edit.title}
      description="A little of your taste. A little of theirs. Something that’s entirely us."
      action={
        <div className="row">
          <button
            onClick={() => setPreview(true)}
            disabled={!edit.photos.length}
          >
            Preview carousel
          </button>
          <button
            className="primary"
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving
              ? "Saving…"
              : dirty
                ? "Save our changes"
                : "All changes saved"}
          </button>
        </div>
      }
    >
      <div className="studio-status">
        <span className="badge">{status(edit.status)}</span>
        <span>
          {dirty ? "You have unsaved changes" : "Saved for both of you"}
        </span>
        <Link to="/memories">
          Find more photographs <ArrowRight size={15} />
        </Link>
      </div>
      {initial.version !== edit.version && dirty && (
        <div className="error-panel">
          Your partner has saved a newer version. Your local edits are still
          here. Copy anything you want to keep, then{" "}
          <button onClick={() => setReloading(true)}>
            reload their changes
          </button>
          .
        </div>
      )}
      {error && (
        <div role="alert" className="error-panel">
          {error}
        </div>
      )}
      <div className="studio-layout">
        <section className="studio-main">
          <div className="section-title">
            <div>
              <h2>Our carousel</h2>
              <p>The first photograph is your cover.</p>
            </div>
            <span>{edit.photos.length} selected</span>
          </div>
          {!edit.photos.length ? (
            <div className="studio-empty">
              <Heart size={30} />
              <p>A story waiting to take shape.</p>
              <span>Accept a photo from the shortlist below.</span>
              <Link to="/memories">
                Browse our memories <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="carousel-tray">
              {edit.photos.map((p: any, i: number) => (
                <article
                  className="carousel-item"
                  key={p.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(i))
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isInteger(from)) reorder(from, i);
                  }}
                >
                  <div className="carousel-image">
                    <img src={media(p.id)} alt={p.filename} />
                    <span>
                      {String(i + 1).padStart(2, "0")}
                      {i === 0 ? " · Cover" : ""}
                    </span>
                  </div>
                  {p.deleted_at && (
                    <strong className="form-error">
                      In Trash — remove or restore
                    </strong>
                  )}
                  <div className="row">
                    <button
                      className="icon"
                      aria-label={`Move photo ${i + 1} earlier`}
                      disabled={i === 0}
                      onClick={() => reorder(i, i - 1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      className="icon"
                      aria-label={`Move photo ${i + 1} later`}
                      disabled={i === edit.photos.length - 1}
                      onClick={() => reorder(i, i + 1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                    <button
                      className="icon"
                      aria-label={`Make photo ${i + 1} cover`}
                      title="Set as cover photo"
                      disabled={i === 0}
                      onClick={() => reorder(i, 0)}
                    >
                      <Star size={16} />
                    </button>
                    <button
                      className="icon"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() =>
                        change(
                          "photos",
                          edit.photos.filter((x: any) => x.id !== p.id),
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
            <div>
              <h2>The maybe pile</h2>
              <p>
                Suggestions from both of you. Nothing moves into the carousel
                until you choose it.
              </p>
            </div>
            {initial.suggestions.length >= 2 && (
              <button
                type="button"
                onClick={() => setComparing(true)}
              >
                <Columns2 size={16} /> Compare candidates
              </button>
            )}
          </div>
          {!initial.suggestions.length ? (
            <p className="quiet-note">
              Find a photograph in Memories and choose “Add to Studio” to start
              your shared shortlist.
            </p>
          ) : (
            <div className="suggestions">
              {initial.suggestions.map((s: any) => (
                <article key={s.photo_id + s.user_id}>
                  <img
                    src={media(s.photo_id)}
                    alt={s.filename}
                    loading="lazy"
                  />
                  <div>
                    <strong>{s.name}’s pick</strong>
                    <small>{s.filename}</small>
                    <button
                      disabled={
                        s.deleted_at ||
                        s.status !== "ready" ||
                        edit.photos.some((p: any) => p.id === s.photo_id)
                      }
                      onClick={() =>
                        change("photos", [
                          ...edit.photos,
                          {
                            id: s.photo_id,
                            filename: s.filename,
                            status: s.status,
                          },
                        ])
                      }
                    >
                      {edit.photos.some((p: any) => p.id === s.photo_id)
                        ? "In our carousel"
                        : "Add to carousel"}
                    </button>
                    {s.user_id === user.id && (
                      <button
                        className="ghost"
                        onClick={async () => {
                          try {
                            await api(
                              `/drafts/${edit.id}/suggestions/${s.photo_id}`,
                              "DELETE",
                            );
                            refresh();
                          } catch (e) {
                            notice((e as Error).message);
                          }
                        }}
                      >
                        Remove suggestion
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <section className="panel caption-panel">
            <h2>Find the words.</h2>
            <NoteField
              label="Final caption"
              value={edit.caption}
              onChange={(e) => change("caption", e.target.value)}
              rows={6}
            />
            <small>{edit.caption.length} characters</small>
            <NoteField
              label="Hashtags"
              value={edit.hashtags}
              onChange={(e) => change("hashtags", e.target.value)}
              rows={2}
            />
            <div className="row">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(edit.caption);
                    notice("Caption copied.");
                  } catch {
                    notice("Select the caption text and copy it manually.");
                  }
                }}
              >
                Copy caption
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(edit.hashtags);
                    notice("Hashtags copied.");
                  } catch {
                    notice("Select the hashtags and copy them manually.");
                  }
                }}
              >
                Copy hashtags
              </button>
            </div>
            <details>
              <summary>
                Caption ideas & saved versions ({initial.captions.length})
              </summary>
              {initial.captions.map((c: any) => (
                <div className="comment" key={c.id}>
                  <strong>{c.name}</strong>
                  <p>{c.body}</p>
                  <button onClick={() => change("caption", c.body)}>
                    Use this caption
                  </button>
                </div>
              ))}
              <ActionForm
                submit="Suggest a caption"
                onSubmit={async (data) => {
                  await api(`/drafts/${edit.id}/captions`, "POST", data);
                  refresh();
                }}
              >
                <NoteField label="Another way to say it" name="body" />
              </ActionForm>
            </details>
          </section>
          <section className="panel">
            <h2>Little notes to each other</h2>
            {initial.comments.map((c: any) => (
              <div className="comment" key={c.id}>
                <strong>{c.name}</strong>
                {c.photo_id && <small>About a photograph</small>}
                <p>{c.body}</p>
              </div>
            ))}
            <ActionForm
              submit="Leave a note"
              onSubmit={async (data) => {
                await api(`/drafts/${edit.id}/comments`, "POST", {
                  ...data,
                  photo_id: data.photo_id || null,
                });
                refresh();
              }}
            >
              <NoteField label="What are you thinking?" name="body" rows={3} />
              <Select label="About" name="photo_id">
                <option value="">The whole post</option>
                {edit.photos.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.filename}
                  </option>
                ))}
              </Select>
            </ActionForm>
          </section>
        </section>
        <aside className="studio-side">
          <section className="panel">
            <span className="eyebrow">THE FINISHING TOUCHES</span>
            <h2>Our plan</h2>
            <Field
              label="Post title"
              value={edit.title}
              onChange={(e) => change("title", e.target.value)}
            />
            <NoteField
              label="Notes"
              value={edit.notes}
              onChange={(e) => change("notes", e.target.value)}
              rows={3}
            />
            <Select
              label="Where we are"
              value={edit.status}
              onChange={(e: any) => change("status", e.target.value)}
            >
              {[
                "collecting",
                "ready_to_curate",
                "final_review",
                "ready_to_post",
                "posted",
                "archived",
              ].map((s) => (
                <option key={s} value={s}>
                  {status(s)}
                </option>
              ))}
            </Select>
            <Select
              label="Carousel shape"
              value={edit.ratio}
              onChange={(e: any) => change("ratio", e.target.value)}
            >
              <option value="4:5">Portrait · 4:5</option>
              <option value="3:4">Tall portrait · 3:4</option>
              <option value="1:1">Square · 1:1</option>
              <option value="1.91:1">Landscape · 1.91:1</option>
            </Select>
            <Select
              label="How photos fit"
              value={edit.fit}
              onChange={(e: any) => change("fit", e.target.value)}
            >
              <option value="contain">
                Keep the whole photo · white borders
              </option>
              <option value="cover">Fill the frame · centre crop</option>
            </Select>
            <p className="hint">
              Only the export changes. Your originals stay untouched.
            </p>
            {edit.status === "posted" && (
              <Field
                label="Instagram post URL (optional)"
                value={edit.post_url}
                onChange={(e) => change("post_url", e.target.value)}
              />
            )}
          </section>
          <section className="panel approvals">
            <Heart size={25} />
            <h2>Ready, together.</h2>
            <p>Both of us get the last word.</p>
            {users.data?.map((u: any) => (
              <div className="approval" key={u.id}>
                <span className="avatar">{u.name.slice(0, 1)}</span>
                <span>
                  {u.name}
                  <small>
                    {initial.approvals.some((a: any) => a.user_id === u.id)
                      ? "Approved this version"
                      : "Not approved yet"}
                  </small>
                </span>
                {initial.approvals.some((a: any) => a.user_id === u.id) && (
                  <Check size={18} />
                )}
              </div>
            ))}
            <button
              className="primary"
              disabled={
                dirty ||
                !["final_review", "ready_to_post"].includes(edit.status) ||
                initial.approvals.some((a: any) => a.user_id === user.id)
              }
              onClick={approve}
            >
              Looks like us · Approve
            </button>
            <small>
              Save changes and move to Final Review first. Changes to photos,
              order, caption, hashtags or crop clear both approvals.
            </small>
          </section>
          <section className="panel">
            <h2>
              <Music size={21} /> A song for this moment
            </h2>
            {initial.songs.map((s: any) => (
              <div className="song" key={s.id}>
                <strong>{s.title}</strong>
                <p>{s.artist}</p>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer">
                    Listen on the original service ↗
                  </a>
                )}
                <small>
                  {s.name} · {s.notes}
                </small>
              </div>
            ))}
            <details>
              <summary>Suggest a song</summary>
              <ActionForm
                submit="Add song idea"
                onSubmit={async (data) => {
                  await api(`/drafts/${edit.id}/songs`, "POST", data);
                  refresh();
                }}
              >
                <Field label="Song title" name="title" required />
                <Field label="Artist" name="artist" />
                <Field label="Music link (optional)" type="url" name="link" />
                <NoteField label="Why this one?" name="notes" rows={2} />
              </ActionForm>
            </details>
          </section>
          <section className="panel">
            <h2>Take it with you.</h2>
            <p>
              Numbered photographs, your caption, and song ideas. Ready for you
              to post manually.
            </p>
            <button
              className="primary"
              disabled={
                dirty || !["ready_to_post", "posted"].includes(edit.status)
              }
              onClick={async () => {
                try {
                  setJob((await api(`/drafts/${edit.id}/exports`, "POST")).id);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Download size={17} /> Prepare our export
            </button>
            {job && (
              <div className="export-state" role="status">
                {exp.data?.state === "completed" ? (
                  <a className="button" href={`/api/exports/${job}/download`}>
                    Download ordered ZIP
                  </a>
                ) : exp.data?.state === "failed" ? (
                  <p>{exp.data.error}</p>
                ) : (
                  <p>Preparing photographs, one at a time…</p>
                )}
              </div>
            )}
            {edit.status === "ready_to_post" && (
              <div style={{ marginTop: "18px" }}>
                <ActionForm
                  submit="Mark as posted to Instagram"
                  onSubmit={async (data) => {
                    await api(`/drafts/${edit.id}`, "PUT", {
                      version: edit.version,
                      title: edit.title,
                      notes: edit.notes,
                      caption: edit.caption,
                      hashtags: edit.hashtags,
                      ratio: edit.ratio,
                      fit: edit.fit,
                      photos: edit.photos.map((p: any) => p.id),
                      status: "posted",
                      post_url: data.post_url || "",
                    });
                    setDirty(false);
                    await refresh();
                    client.invalidateQueries({ queryKey: ["drafts"] });
                    notice("Draft marked as posted!");
                  }}
                >
                  <Field
                    label="Instagram post URL (optional)"
                    name="post_url"
                    placeholder="https://www.instagram.com/p/..."
                    defaultValue={edit.post_url}
                  />
                </ActionForm>
              </div>
            )}
          </section>
        </aside>
      </div>
      {preview && (
        <Modal title="A preview of our post" onClose={() => setPreview(false)}>
          <div className="instagram-preview">
            <header>
              <span className="avatar">♥</span>
              <strong>Our next little story</strong>
            </header>
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
          title="Reload your partner’s version?"
          body="Your unsaved changes will be discarded. Copy any text you want to keep before continuing."
          action="Reload latest version"
          onClose={() => setReloading(false)}
          onConfirm={async () => {
            setEdit(initial);
            setDirty(false);
          }}
        />
      )}
      {leaving && (
        <Confirm
          title="Leave our unsaved changes?"
          body="Your changes have not been saved for your partner. Stay here to save them, or discard them and leave."
          action="Discard changes and leave"
          onClose={() => setLeaving(null)}
          onConfirm={async () => {
            setDirty(false);
            navigate(leaving);
          }}
        />
      )}
      {comparing && (
        <CompareModal
          candidates={[...initial.suggestions, ...edit.photos]}
          carouselIds={edit.photos.map((p: any) => p.id)}
          onAdd={(photo) => {
            change("photos", [...edit.photos, photo]);
            notice("Added to carousel!");
          }}
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
    <Modal title="Compare candidate photographs" onClose={onClose} wide>
      <p>
        Compare two moments side by side before deciding on your final carousel.
      </p>
      <div className="compare-grid">
        <div className="compare-card">
          <Select
            label="Candidate A"
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
                  : "Add candidate A to carousel"}
              </button>
            </>
          )}
        </div>
        <div className="compare-card">
          <Select
            label="Candidate B"
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
                  : "Add candidate B to carousel"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
