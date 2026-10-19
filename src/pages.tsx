import { useState, useEffect, useContext, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Heart,
  Plus,
  Search,
  X,
  Download,
  Info,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ZoomIn,
  ZoomOut,
  FolderHeart,
  Sparkles,
  MapPin,
  Calendar,
} from "lucide-react";
import { api, media, bytes, date, status } from "./api";
import {
  Page,
  Empty,
  Modal,
  ActionForm,
  Field,
  NoteField,
  Select,
  Loading,
  Failure,
  Confirm,
  useNotice,
} from "./ui";
import { client, User } from "./main";
export function Home({ upload }: { upload: () => void }) {
  const user = useContext(User);
  const [viewer, setViewer] = useState<string | null>(null);
  const photos = useQuery({
    queryKey: ["photos", "home"],
    queryFn: () => api("/photos"),
    refetchInterval: 15000,
  });
  const drafts = useQuery({
    queryKey: ["drafts"],
    queryFn: () => api("/drafts"),
  });
  const day = useQuery({
    queryKey: ["photos", "day"],
    queryFn: () => api("/photos?onThisDay=true"),
  });
  const albums = useQuery({
    queryKey: ["albums"],
    queryFn: () => api("/albums"),
  });
  const moments = useQuery({
    queryKey: ["moments"],
    queryFn: () => api("/moments"),
  });
  const ready =
    photos.data?.items.filter((p: any) => p.status === "ready") || [];
  const featured = ready.find((p: any) => p.featured) || ready[0];
  return (
    <Page
      eyebrow="A LITTLE SPACE, JUST FOR US"
      title={`Hello, ${user.name.split(" ")[0]}.`}
      description="The big adventures. The tiny, beautiful in-betweens."
    >
      <div className="section-label">
        <span>OUR STORY, STILL UNFOLDING</span>
        <span>
          {new Date().toLocaleDateString("en-IN", {
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>
      {photos.isPending ? (
        <Loading />
      ) : photos.error ? (
        <Failure error={photos.error} retry={() => photos.refetch()} />
      ) : !photos.data.items.length ? (
        <Empty
          title="Every story starts with a moment."
          body="A blurry first date. A favourite sunset. That ordinary Tuesday. Give your memories a place to call home."
          action={
            <button className="primary" onClick={upload}>
              <Plus size={17} /> Add our first memories
            </button>
          }
        />
      ) : (
        <>
          <section className="home-feature">
            {featured ? (
              <div
                className="home-feature-link"
                role="button"
                tabIndex={0}
                onClick={() => setViewer(featured.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setViewer(featured.id);
                }}
              >
                <img
                  src={media(featured.id, "preview")}
                  alt={featured.filename}
                />
                <div className="feature-caption">
                  <span>A MOMENT WORTH KEEPING</span>
                  <h2>{date(featured.capture_local)}</h2>
                  <span>
                    View this memory <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            ) : (
              <Empty
                title="Making room for your memories."
                body="Your originals are safe. Previews are being prepared."
              />
            )}
            <aside className="studio-invite">
              <span className="eyebrow">OUR STUDIO</span>
              <h2>
                Some things are
                <br />
                better <em>together.</em>
              </h2>
              <p>
                Pick a few favourites. Find the words. Make something that feels
                like us.
              </p>
              <Link className="button" to="/studio">
                Let's make a post <ArrowRight size={16} />
              </Link>
            </aside>
          </section>
          <div className="section-title">
            <h2>Recently added to our story</h2>
            <Link to="/memories">
              See all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mini-grid">
            {ready.slice(0, 5).map((p: any) => (
              <div
                className="mini-card-link"
                role="button"
                tabIndex={0}
                key={p.id}
                onClick={() => setViewer(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setViewer(p.id);
                }}
              >
                <img src={media(p.id)} alt={p.filename} loading="lazy" />
                <span>{date(p.capture_local)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {day.data?.items.length > 0 && (
        <section>
          <div className="section-title">
            <h2>On this day, once upon a time</h2>
          </div>
          <div className="mini-grid">
            {day.data.items.slice(0, 5).map((p: any) => (
              <div
                className="mini-card-link"
                role="button"
                tabIndex={0}
                key={p.id}
                onClick={() => setViewer(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setViewer(p.id);
                }}
              >
                <img src={media(p.id)} alt={p.filename} />
                <span>{date(p.capture_local)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {drafts.data?.some((d: any) => d.status !== "archived") && (
        <section>
          <div className="section-title">
            <h2>Where we left off</h2>
            <Link to="/studio">
              Our Studio <ArrowRight size={15} />
            </Link>
          </div>
          <div className="cards">
            {drafts.data
              .filter((d: any) => d.status !== "archived")
              .slice(0, 3)
              .map((d: any) => (
                <Link className="small-card" key={d.id} to={`/studio/${d.id}`}>
                  <span
                    className={`badge ${d.status === "final_review" ? "badge-highlight" : ""}`}
                  >
                    {d.status === "final_review"
                      ? "Ready for joint review ♥"
                      : status(d.status)}
                  </span>
                  <h3>{d.title}</h3>
                  <p>{d.count} photographs · Keep creating together</p>
                </Link>
              ))}
          </div>
        </section>
      )}
      {moments.data?.moments?.length > 0 && (
        <section>
          <div className="section-title">
            <h2>Recent Outings & Moments</h2>
            <Link to="/memories?view=moments">
              Explore all moments <ArrowRight size={15} />
            </Link>
          </div>
          <div className="cards">
            {moments.data.moments.slice(0, 3).map((m: any) => (
              <div
                className="small-card moment-card-mini"
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (m.items?.[0]) setViewer(m.items[0].id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if (m.items?.[0]) setViewer(m.items[0].id);
                  }
                }}
              >
                <span className="badge">
                  {m.photoCount} {m.photoCount === 1 ? "photograph" : "photographs"}
                </span>
                <h3>{m.title}</h3>
                <p>
                  {m.dateFormatted} {m.timeRange ? `· ${m.timeRange}` : ""}
                </p>
                {m.items?.length > 0 && (
                  <div className="mini-moment-thumbs">
                    {m.items.slice(0, 4).map((p: any) => (
                      <img
                        key={p.id}
                        src={media(p.id)}
                        alt={p.filename}
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {albums.data?.length > 0 && (
        <section>
          <div className="section-title">
            <h2>Our chapters</h2>
            <Link to="/albums">
              Browse {albums.data.length} albums <ArrowRight size={15} />
            </Link>
          </div>
          <div className="cards">
            {albums.data.slice(0, 3).map((a: any) => (
              <Link className="small-card" key={a.id} to={`/albums/${a.id}`}>
                <span className="badge">
                  {a.count} {a.count === 1 ? "photograph" : "photographs"}
                </span>
                <h3>{a.title}</h3>
                <p>
                  {a.description || (a.location ? `In ${a.location}` : "Open this chapter")}{" "}
                  <ArrowRight size={13} />
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      {viewer && (
        <PhotoViewer
          id={viewer}
          items={ready}
          onNavigate={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </Page>
  );
}
export function AddTo({
  ids,
  onClose,
}: {
  ids: string[];
  onClose: () => void;
}) {
  const albums = useQuery({
    queryKey: ["albums"],
    queryFn: () => api("/albums"),
  });
  const drafts = useQuery({
    queryKey: ["drafts"],
    queryFn: () => api("/drafts"),
  });
  const [kind, setKind] = useState("draft"),
    [target, setTarget] = useState("");
  const notice = useNotice();
  return (
    <Modal
      title={`Keep ${ids.length} ${ids.length === 1 ? "moment" : "moments"} together`}
      onClose={onClose}
    >
      <ActionForm
        submit="Add selected photos"
        onSubmit={async (data) => {
          let id = target;
          if (!id) {
            const result = await api(
              kind === "draft" ? "/drafts" : "/albums",
              "POST",
              { title: data.title },
            );
            id = result.id;
          }
          await api(
            kind === "draft"
              ? `/drafts/${id}/suggestions`
              : `/albums/${id}/photos`,
            kind === "draft" ? "POST" : "PUT",
            { ids },
          );
          client.invalidateQueries();
          notice(
            kind === "draft"
              ? "Added to your shared shortlist."
              : "Added to the album.",
          );
          onClose();
        }}
      >
        <Select
          label="Add to"
          value={kind}
          onChange={(e: any) => {
            setKind(e.target.value);
            setTarget("");
          }}
        >
          <option value="draft">Our Studio shortlist</option>
          <option value="album">An album</option>
        </Select>
        <Select
          label={kind === "draft" ? "Studio draft" : "Album"}
          value={target}
          onChange={(e: any) => setTarget(e.target.value)}
        >
          <option value="">Create something new</option>
          {(kind === "draft" ? drafts.data : albums.data)?.map((a: any) => (
            <option value={a.id} key={a.id}>
              {a.title}
            </option>
          ))}
        </Select>
        {!target && <Field label="Title" name="title" required />}
        <p className="hint">
          Studio photos begin as suggestions. Your partner’s final arrangement
          stays intact.
        </p>
      </ActionForm>
    </Modal>
  );
}
export function Gallery({
  favorites = false,
  trash = false,
}: {
  favorites?: boolean;
  trash?: boolean;
}) {
  const { albumId } = useParams();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const [viewMode, setViewMode] = useState<"grid" | "moments">(
    params.get("view") === "moments" ? "moments" : "grid",
  );
  const [selection, setSelection] = useState<string[]>([]),
    [viewer, setViewer] = useState<string | null>(null),
    [adding, setAdding] = useState(false),
    [editAlbum, setEditAlbum] = useState(false);
  const observer = useRef<HTMLDivElement>(null);
  const albums = useQuery({
    queryKey: ["albums"],
    queryFn: () => api("/albums"),
  });
  const album = albums.data?.find((a: any) => a.id === albumId);
  const filter = params.get("favorite") || "mine";
  const query = new URLSearchParams({
    ...(params.get("q") ? { q: params.get("q")! } : {}),
    ...(favorites ? { favorite: filter } : {}),
    ...(trash ? { trash: "true" } : {}),
    ...(albumId ? { album: albumId } : {}),
    ...(params.get("new") ? { new: "true" } : {}),
    ...(params.get("date") ? { date: params.get("date")! } : {}),
  });
  const moments = useQuery({
    queryKey: ["moments"],
    queryFn: () => api("/moments"),
    enabled: viewMode === "moments" && !favorites && !trash && !albumId,
  });
  const photos = useInfiniteQuery({
    queryKey: ["photos", query.toString()],
    queryFn: ({ pageParam }) =>
      api(`/photos?${query}${pageParam ? "&cursor=" + pageParam : ""}`),
    initialPageParam: "",
    getNextPageParam: (last: any) => last.next || undefined,
    maxPages: 5,
    refetchInterval: 15000,
  });
  const items = photos.data?.pages.flatMap((p) => p.items) || [];
  useEffect(() => {
    const el = observer.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          photos.hasNextPage &&
          !photos.isFetchingNextPage
        )
          photos.fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [photos.hasNextPage, photos.isFetchingNextPage, items.length]);
  useEffect(() => setSelection([]), [query.toString()]);
  const notice = useNotice();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkPermanent, setBulkPermanent] = useState(false);
  async function act(fn: () => Promise<any>) {
    try {
      await fn();
      client.invalidateQueries({ queryKey: ["photos"] });
    } catch (e) {
      notice((e as Error).message);
    }
  }
  return (
    <Page
      eyebrow={
        albumId
          ? "ONE CHAPTER OF US"
          : favorites
            ? "THE ONES WE LOVE MOST"
            : "A LIFE, COLLECTED"
      }
      title={
        trash
          ? "A little breathing room."
          : album?.title ||
            (favorites ? "Close to our hearts." : "Our memories.")
      }
      description={
        trash
          ? "Photos stay here for the configured retention period before permanent deletion."
          : album?.description ||
            "Every place. Every season. Every version of us."
      }
      action={
        album && <button onClick={() => setEditAlbum(true)}>Edit album</button>
      }
    >
      <div className="gallery-toolbar">
        <form
          className="search"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setParams((p) => {
              search ? p.set("q", search) : p.delete("q");
              return p;
            });
          }}
        >
          <Search size={18} />
          <input
            aria-label="Search photos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a memory by filename"
          />
          {search && (
            <button
              type="button"
              className="icon"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setParams((p) => {
                  p.delete("q");
                  return p;
                });
              }}
            >
              <X size={16} />
            </button>
          )}
          <button className="ghost" type="submit">
            Search
          </button>
        </form>
        {favorites ? (
          <Select
            label="Whose favourites?"
            value={filter}
            onChange={(e: any) =>
              setParams((p) => {
                p.set("favorite", e.target.value);
                return p;
              })
            }
          >
            <option value="mine">Mine</option>
            <option value="both">Both of ours</option>
            <option value="partner">My partner’s</option>
          </Select>
        ) : (
          !trash && (
            <button
              aria-pressed={params.has("new")}
              onClick={() =>
                setParams((p) => {
                  p.has("new") ? p.delete("new") : p.set("new", "true");
                  return p;
                })
              }
            >
              New for you
            </button>
          )
        )}
        {!favorites && !trash && !albumId && (
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => {
                setViewMode("grid");
                setParams((p) => {
                  p.delete("view");
                  return p;
                });
              }}
            >
              Timeline
            </button>
            <button
              type="button"
              className={viewMode === "moments" ? "active" : ""}
              onClick={() => {
                setViewMode("moments");
                setParams((p) => {
                  p.set("view", "moments");
                  return p;
                });
              }}
            >
              <Sparkles size={13} style={{ marginRight: 4 }} /> Moments & Outings
            </button>
          </div>
        )}
      </div>
      {params.get("date") && (
        <div className="filter-pill">
          <span>Memories from {params.get("date")}</span>
          <button
            type="button"
            aria-label="Clear date filter"
            onClick={() => {
              setParams((p) => {
                p.delete("date");
                return p;
              });
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {selection.length > 0 && (
        <div className="selection-bar">
          <strong>{selection.length} selected</strong>
          {trash ? (
            <>
              <button
                onClick={() =>
                  act(async () => {
                    await api("/photos/bulk-restore", "POST", { ids: selection });
                    setSelection([]);
                    notice(`Restored ${selection.length} memories.`);
                  })
                }
              >
                Restore selected
              </button>
              <button onClick={() => setBulkPermanent(true)}>
                Permanently delete selected
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setAdding(true)}>
                Add to album or Studio
              </button>
              {albumId && (
                <button
                  onClick={() =>
                    act(async () => {
                      await api(`/albums/${albumId}/photos`, "PUT", {
                        ids: selection,
                        remove: true,
                      });
                      setSelection([]);
                    })
                  }
                >
                  Remove from album
                </button>
              )}
              <a
                className="button"
                href={`/api/photos-download?ids=${selection.join(",")}`}
              >
                Download originals ZIP
              </a>
              <button
                onClick={() =>
                  act(async () => {
                    await api("/photos/bulk-trash", "POST", { ids: selection });
                    setSelection([]);
                    notice(`Moved ${selection.length} memories to Trash.`);
                  })
                }
              >
                Move to Trash
              </button>
            </>
          )}
          <button onClick={() => setSelection([])}>Clear selection</button>
        </div>
      )}
      {viewMode === "moments" && !favorites && !trash && !albumId ? (
        moments.isPending ? (
          <Loading />
        ) : moments.error ? (
          <Failure error={moments.error} retry={() => moments.refetch()} />
        ) : !moments.data?.moments?.length ? (
          <Empty
            title="No moments collected yet."
            body="Upload photographs to see them automatically clustered into shared moments and outings."
          />
        ) : (
          <div className="moments-list">
            {moments.data.moments.map((m: any) => (
              <div className="moment-card" key={m.id}>
                <div className="moment-header">
                  <div>
                    <div className="moment-eyebrow">
                      <span>{m.dateFormatted}</span>
                      {m.timeRange && <span>· {m.timeRange}</span>}
                      {m.hasGps && (
                        <span className="gps-badge">
                          <MapPin size={11} /> Location cluster
                        </span>
                      )}
                    </div>
                    <h2>{m.title}</h2>
                  </div>
                  <div className="moment-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setParams((p) => {
                          p.set("date", m.date);
                          p.delete("view");
                          return p;
                        });
                        setViewMode("grid");
                      }}
                    >
                      View all {m.photoCount} photos
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setSelection(m.photoIds);
                        setAdding(true);
                      }}
                    >
                      <Sparkles size={14} /> Add moment to Studio
                    </button>
                  </div>
                </div>
                <div className="moment-strip">
                  {m.items.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      className="moment-thumb"
                      onClick={() => setViewer(p.id)}
                      aria-label={`View photo ${p.filename}`}
                    >
                      <img src={media(p.id)} alt={p.filename} loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : photos.isPending ? (
        <Loading />
      ) : photos.error ? (
        <Failure error={photos.error} retry={() => photos.refetch()} />
      ) : !items.length ? (
        <Empty
          title={
            trash
              ? "Nothing left behind."
              : favorites
                ? "The ones you’ll come back to."
                : "A place for every memory."
          }
          body={
            search
              ? "No photographs match that search. Try another filename."
              : trash
                ? "Your trash is empty."
                : favorites
                  ? "Tap the heart on a photograph to keep it close."
                  : "Add photographs to your library, then collect them here."
          }
          action={
            <Link className="button" to="/memories">
              Browse our memories
            </Link>
          }
        />
      ) : (
        <div className="gallery">
          {items.map((p: any, i: number) => (
            <div
              className="photo-card"
              key={p.id}
              style={{
                contentVisibility: "auto",
                containIntrinsicSize: "250px",
              }}
            >
              {(i === 0 ||
                p.capture_local.slice(0, 7) !==
                  items[i - 1].capture_local.slice(0, 7)) && (
                <span className="month-label">
                  {new Date(p.capture_local).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              <button
                className="photo-open"
                onClick={() => !trash && setViewer(p.id)}
                disabled={trash}
                aria-label={`View ${p.filename}`}
              >
                {p.status === "ready" ? (
                  <img
                    src={media(p.id) + (trash ? "?trash=true" : "")}
                    loading="lazy"
                    alt={p.filename}
                  />
                ) : (
                  <div className="processing">
                    <span className="spinner" />
                    {p.status === "failed"
                      ? "Preview unavailable"
                      : "Preparing your memory…"}
                  </div>
                )}
              </button>
              <label className="photo-select">
                <input
                  type="checkbox"
                  aria-label={`Select ${p.filename}`}
                  checked={selection.includes(p.id)}
                  onChange={(e) =>
                    setSelection((s) =>
                      e.target.checked
                        ? [...s, p.id]
                        : s.filter((id) => id !== p.id),
                    )
                  }
                />
              </label>
              {!trash && (
                <>
                  {p.is_new && <span className="new-badge">New</span>}
                  <button
                    className={`favorite ${p.favorite ? "is-favorite" : ""}`}
                    aria-label={`${p.favorite ? "Unfavorite" : "Favorite"} ${p.filename}`}
                    onClick={() =>
                      act(() =>
                        api(`/photos/${p.id}/favorite`, "PUT", {
                          favorite: !p.favorite,
                        }),
                      )
                    }
                  >
                    <Heart
                      size={18}
                      fill={p.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </>
              )}
              <div className="photo-caption">
                <span title={p.filename}>{p.filename}</span>
                {trash ? (
                  <div className="row">
                    <button
                      onClick={() =>
                        act(() => api(`/photos/${p.id}/restore`, "POST"))
                      }
                    >
                      Restore
                    </button>
                    <button
                      className="icon"
                      aria-label={`Permanently delete ${p.filename}`}
                      onClick={() => setDeleting(p.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <small>{date(p.capture_local)}</small>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {viewMode === "grid" && (
        <div ref={observer} className="pagination">
          {photos.hasNextPage && (
            <button
              disabled={photos.isFetchingNextPage}
              onClick={() => photos.fetchNextPage()}
            >
              {photos.isFetchingNextPage ? "Loading…" : "More memories"}
            </button>
          )}
        </div>
      )}
      {viewer && (
        <PhotoViewer
          id={viewer}
          items={
            viewMode === "moments" && moments.data?.moments
              ? moments.data.moments.flatMap((m: any) => m.items)
              : items
          }
          onNavigate={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
      {adding && (
        <AddTo
          ids={selection}
          onClose={() => {
            setAdding(false);
            setSelection([]);
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="Delete this original forever?"
          body="The original file and its previews will be removed. This cannot be undone. Make sure you have a backup."
          action="Permanently delete"
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            act(() => api(`/photos/${deleting}/permanent`, "DELETE"))
          }
        />
      )}
      {bulkPermanent && (
        <Confirm
          title={`Permanently delete ${selection.length} photos?`}
          body="The original files and all previews will be completely removed. This cannot be undone. Make sure you have a backup."
          action="Permanently delete all"
          onClose={() => setBulkPermanent(false)}
          onConfirm={() =>
            act(async () => {
              await api("/photos/bulk-permanent", "POST", { ids: selection });
              setSelection([]);
              notice(`Permanently deleted ${selection.length} photos.`);
            })
          }
        />
      )}
      {editAlbum && (
        <AlbumEditor album={album} onClose={() => setEditAlbum(false)} />
      )}
    </Page>
  );
}
function formatMetadata(metadata: any) {
  const items: { label: string; value: string }[] = [];
  if (metadata.Make || metadata.Model) {
    items.push({
      label: "Camera",
      value: [metadata.Make, metadata.Model].filter(Boolean).join(" "),
    });
  }
  if (metadata.LensModel) {
    items.push({ label: "Lens", value: String(metadata.LensModel) });
  }
  if (metadata.FocalLength != null) {
    items.push({ label: "Focal length", value: `${metadata.FocalLength} mm` });
  }
  if (metadata.FNumber != null) {
    items.push({ label: "Aperture", value: `ƒ/${metadata.FNumber}` });
  }
  if (metadata.ExposureTime != null) {
    const exp = Number(metadata.ExposureTime);
    const expStr =
      exp < 1 && exp > 0 ? `1/${Math.round(1 / exp)}s` : `${exp}s`;
    items.push({ label: "Shutter speed", value: expStr });
  }
  if (metadata.ISO != null) {
    items.push({ label: "ISO", value: String(metadata.ISO) });
  }
  if (metadata.Flash != null) {
    items.push({ label: "Flash", value: String(metadata.Flash) });
  }
  if (metadata.latitude != null && metadata.longitude != null) {
    const lat = Number(metadata.latitude).toFixed(4);
    const lng = Number(metadata.longitude).toFixed(4);
    items.push({
      label: "Location",
      value: `${lat}°, ${lng}°${metadata.GPSAltitude ? ` (${Math.round(metadata.GPSAltitude)} m)` : ""}`,
    });
  }
  if (metadata.colorSpace) {
    items.push({ label: "Color space", value: String(metadata.colorSpace) });
  }
  if (metadata.Software) {
    items.push({ label: "Software", value: String(metadata.Software) });
  }
  return items;
}
export function PhotoViewer({
  id,
  items,
  onNavigate,
  onClose,
}: {
  id: string;
  items: any[];
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const photo = useQuery({
    queryKey: ["photo", id],
    queryFn: () => api(`/photos/${id}`),
  });
  const [details, setDetails] = useState(false),
    [adding, setAdding] = useState(false),
    [remove, setRemove] = useState(false),
    [zoom, setZoom] = useState(false);
  const touch = useRef(0);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const index = items.findIndex((p) => p.id === id);
  const notice = useNotice();
  function next(step: number) {
    if (items[index + step]) {
      onNavigate(items[index + step].id);
      setZoom(false);
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.key === "ArrowLeft") next(-1);
      if (e.key === "ArrowRight") next(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [id, index]);
  const p = photo.data;
  return (
    <Modal title={p?.filename || "A memory"} onClose={onClose} wide>
      {photo.isPending ? (
        <Loading />
      ) : photo.error ? (
        <Failure error={photo.error} retry={() => photo.refetch()} />
      ) : (
        <>
          <div
            ref={imageContainerRef}
            className={`viewer-image ${zoom ? "zoomed" : ""}`}
            onTouchStart={(e) => {
              touch.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (
                !zoom &&
                Math.abs(e.changedTouches[0].clientX - touch.current) > 60
              )
                next(e.changedTouches[0].clientX > touch.current ? -1 : 1);
            }}
            onMouseDown={(e) => {
              if (zoom && imageContainerRef.current) {
                isDragging.current = true;
                startPos.current = {
                  x: e.clientX,
                  y: e.clientY,
                  scrollLeft: imageContainerRef.current.scrollLeft,
                  scrollTop: imageContainerRef.current.scrollTop,
                };
              }
            }}
            onMouseMove={(e) => {
              if (isDragging.current && imageContainerRef.current) {
                const dx = e.clientX - startPos.current.x;
                const dy = e.clientY - startPos.current.y;
                imageContainerRef.current.scrollLeft =
                  startPos.current.scrollLeft - dx;
                imageContainerRef.current.scrollTop =
                  startPos.current.scrollTop - dy;
              }
            }}
            onMouseUp={() => {
              isDragging.current = false;
            }}
            onMouseLeave={() => {
              isDragging.current = false;
            }}
          >
            {p.status === "ready" ? (
              <img src={media(id, "preview")} alt={p.filename} />
            ) : (
              <div className="processing">
                {p.error || "Preparing your photo…"}
                {p.status === "failed" && (
                  <button
                    onClick={async () => {
                      try {
                        await api(`/photos/${id}/retry`, "POST");
                        photo.refetch();
                      } catch (e) {
                        notice((e as Error).message);
                      }
                    }}
                  >
                    Retry processing
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="viewer-controls">
            <div className="row">
              <button
                className="icon"
                aria-label="Previous photo"
                disabled={index <= 0}
                onClick={() => next(-1)}
              >
                <ChevronLeft />
              </button>
              <span>
                {index + 1} / {items.length}
              </span>
              <button
                className="icon"
                aria-label="Next photo"
                disabled={index === items.length - 1}
                onClick={() => next(1)}
              >
                <ChevronRight />
              </button>
            </div>
            <div className="row">
              <button
                className="icon"
                aria-label={zoom ? "Zoom out" : "Zoom in"}
                onClick={() => setZoom(!zoom)}
              >
                {zoom ? <ZoomOut /> : <ZoomIn />}
              </button>
              <a
                className="button icon"
                href={media(id, "original")}
                aria-label="Download original"
              >
                <Download />
              </a>
              <button
                className="icon"
                aria-label="Photo details"
                aria-expanded={details}
                onClick={() => setDetails(!details)}
              >
                <Info />
              </button>
              <button onClick={() => setAdding(true)}>Add to Studio</button>
              <button
                className="icon"
                aria-label="Move to Trash"
                onClick={() => setRemove(true)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          {details && (
            <section className="photo-details">
              <h3>The story behind the photograph</h3>
              <dl>
                <dt>Taken</dt>
                <dd>
                  {p.capture_local.replace("T", " ")}{" "}
                  {p.capture_offset || "(local time; timezone unknown)"}
                </dd>
                <dt>Date source</dt>
                <dd>
                  {p.capture_source === "upload"
                    ? "Upload time (no capture date found)"
                    : p.capture_source}
                </dd>
                <dt>Resolution</dt>
                <dd>
                  {p.width} × {p.height}
                </dd>
                <dt>Original file</dt>
                <dd>
                  {bytes(p.size)} · {p.mime}
                </dd>
                <dt>Uploaded</dt>
                <dd>{date(p.uploaded_at)}</dd>
                {formatMetadata(p.metadata).map((item) => (
                  <div className="detail-pair" key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
              <div style={{ marginTop: 12, marginBottom: 16 }}>
                <Link
                  className="button ghost"
                  to={`/memories?date=${p.capture_local.slice(0, 10)}`}
                  onClick={onClose}
                  style={{
                    fontSize: 12,
                    padding: "8px 12px",
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Sparkles size={14} /> View all memories from this day
                </Link>
              </div>
              <ActionForm
                onSubmit={async (data) => {
                  await api(`/photos/${id}`, "PATCH", data);
                  photo.refetch();
                  client.invalidateQueries({ queryKey: ["photos"] });
                  notice(
                    "Capture date updated. Original metadata is unchanged.",
                  );
                }}
                submit="Correct capture date"
              >
                <Field
                  label="Corrected local capture date"
                  name="capture_local"
                  type="datetime-local"
                  defaultValue={p.capture_local.slice(0, 16)}
                  required
                />
              </ActionForm>
              <button
                onClick={async () => {
                  try {
                    await api(`/photos/${id}`, "PATCH", {
                      featured: !p.featured,
                    });
                    photo.refetch();
                    client.invalidateQueries();
                  } catch (e) {
                    notice((e as Error).message);
                  }
                }}
              >
                {p.featured
                  ? "Remove from featured memories"
                  : "Feature on our home page"}
              </button>
              <h3>A note on this moment</h3>
              {p.comments.map((c: any) => (
                <div className="comment" key={c.id}>
                  <div className="comment-header">
                    <strong>{c.name}</strong>
                    {c.created_at && <small>{date(c.created_at)}</small>}
                  </div>
                  <p>{c.body}</p>
                </div>
              ))}
              <ActionForm
                submit="Leave a note"
                onSubmit={async (data) => {
                  await api(`/photos/${id}/comments`, "POST", data);
                  photo.refetch();
                }}
              >
                <NoteField label="Your note" name="body" rows={2} />
              </ActionForm>
            </section>
          )}
        </>
      )}
      {adding && <AddTo ids={[id]} onClose={() => setAdding(false)} />}
      {remove && (
        <Confirm
          title="Move this memory to Trash?"
          body="You can restore it during the retention period. Studio approvals using this photo will be cleared."
          action="Move to Trash"
          onClose={() => setRemove(false)}
          onConfirm={async () => {
            await api(`/photos/${id}`, "DELETE");
            client.invalidateQueries();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
function AlbumEditor({ album, onClose }: { album?: any; onClose: () => void }) {
  const photos = useQuery({
    queryKey: ["album-covers", album?.id],
    queryFn: () => api(`/photos?album=${album.id}`),
    enabled: !!album,
  });
  return (
    <Modal
      title={album ? "Edit our chapter" : "A new chapter"}
      onClose={onClose}
    >
      <ActionForm
        submit={album ? "Save album" : "Create album"}
        onSubmit={async (data) => {
          await api(
            album ? `/albums/${album.id}` : "/albums",
            album ? "PATCH" : "POST",
            { ...data, cover: data.cover || null },
          );
          client.invalidateQueries();
          onClose();
        }}
      >
        <Field
          label="Album title"
          name="title"
          defaultValue={album?.title}
          required
        />
        <NoteField
          label="A few words about it"
          name="description"
          defaultValue={album?.description}
        />
        <Field
          label="Place (optional)"
          name="location"
          defaultValue={album?.location}
        />
        <Field
          label="Date (optional)"
          name="date"
          type="date"
          defaultValue={album?.date || ""}
        />
        {album && (
          <Select
            label="Cover photograph"
            name="cover"
            defaultValue={album.cover || ""}
          >
            <option value="">Automatic</option>
            {photos.data?.items.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.filename}
              </option>
            ))}
          </Select>
        )}
      </ActionForm>
    </Modal>
  );
}
export function Albums() {
  const albums = useQuery({
    queryKey: ["albums"],
    queryFn: () => api("/albums"),
  });
  const [create, setCreate] = useState(false),
    [remove, setRemove] = useState<any>(null);
  return (
    <Page
      title="The chapters of us."
      eyebrow="OUR ALBUMS"
      description="Some memories belong together."
      action={
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={17} /> New album
        </button>
      }
    >
      {albums.isPending ? (
        <Loading />
      ) : albums.error ? (
        <Failure error={albums.error} retry={() => albums.refetch()} />
      ) : !albums.data.length ? (
        <Empty
          title="Give a chapter a name."
          body="A weekend away. An entire summer. All the ordinary days in between."
          action={
            <button onClick={() => setCreate(true)}>
              Create our first album
            </button>
          }
        />
      ) : (
        <div className="album-grid">
          {albums.data.map((a: any) => (
            <article className="album" key={a.id}>
              <Link to={`/albums/${a.id}`}>
                <div className="album-cover">
                  {a.cover_id ? (
                    <img src={media(a.cover_id)} alt="" loading="lazy" />
                  ) : (
                    <FolderHeart size={50} />
                  )}
                </div>
                <h2>{a.title}</h2>
                <p>
                  {a.count} photographs {a.location && `· ${a.location}`}
                </p>
              </Link>
              <button
                className="icon"
                aria-label={`Delete ${a.title}`}
                onClick={() => setRemove(a)}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
      {create && <AlbumEditor onClose={() => setCreate(false)} />}
      {remove && (
        <Confirm
          title={`Delete “${remove.title}”?`}
          body="Only the album is removed. Every original photograph stays in your library."
          action="Delete album"
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            await api(`/albums/${remove.id}`, "DELETE");
            albums.refetch();
          }}
        />
      )}
    </Page>
  );
}
export function Settings({ refresh }: { refresh: () => void }) {
  const user = useContext(User),
    notice = useNotice();
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api("/system"),
    refetchInterval: 30000,
  });
  const [invite, setInvite] = useState("");
  return (
    <Page
      title="Make yourself at home."
      eyebrow="SETTINGS"
      description="A few things to keep our little corner running smoothly."
    >
      <div className="settings-grid">
        <section className="panel">
          <h2>Our people</h2>
          <p>
            Signed in as {user.name}
            <br />
            <small>{user.email}</small>
          </p>
          {user.owner && (
            <>
              <button
                onClick={async () => {
                  try {
                    const result = await api("/invitations", "POST");
                    setInvite(`${location.origin}/#invite=${result.token}`);
                  } catch (e) {
                    notice((e as Error).message);
                  }
                }}
              >
                Create invitation for my person
              </button>
              {invite && (
                <label className="field">
                  <span>Private invitation · valid for 48 hours</span>
                  <input
                    readOnly
                    value={invite}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              <ActionForm
                onSubmit={async (data) => {
                  await api("/settings", "PUT", data);
                  refresh();
                  notice("Your home has a new name.");
                }}
              >
                <Field
                  label="Name of our space"
                  name="name"
                  required
                  defaultValue="Ours"
                />
              </ActionForm>
            </>
          )}
        </section>
        <section className="panel">
          <h2>A little housekeeping</h2>
          {system.isPending ? (
            <Loading />
          ) : system.error ? (
            <Failure error={system.error} retry={() => system.refetch()} />
          ) : (
            <>
              <p className="storage-number">
                {bytes(system.data.storage.available)}
                <span> available</span>
              </p>
              <progress
                max={system.data.storage.capacity}
                value={
                  system.data.storage.capacity - system.data.storage.available
                }
                aria-label="Storage used"
              />
              {system.data.storage.available <
                system.data.storage.reserve * 2 && (
                <p role="alert">
                  Storage is getting low. Make an external backup and free space
                  before your next upload.
                </p>
              )}
              <dl>
                {[
                  "originals",
                  "thumbnails",
                  "previews",
                  "temporary",
                  "exports",
                  "database",
                ].map((k) => (
                  <div className="detail-pair" key={k}>
                    <dt>{k}</dt>
                    <dd>{bytes(system.data.storage[k])}</dd>
                  </div>
                ))}
              </dl>
              <p>Trash is kept for {system.data.trashDays} days.</p>
              <Link className="button" to="/trash">
                <Trash2 size={16} /> Open Trash
              </Link>
              <h3>Preparing memories</h3>
              {system.data.jobs.map((j: any) => (
                <p key={j.state}>
                  {status(j.state)}: {j.count}
                </p>
              ))}
            </>
          )}
        </section>
        <section className="panel">
          <h2>Change password</h2>
          <ActionForm
            submit="Change password & sign out"
            onSubmit={async (data) => {
              await api("/auth/password", "POST", data);
              client.clear();
              refresh();
            }}
          >
            <Field
              label="Current password"
              name="current"
              type="password"
              required
              autoComplete="current-password"
            />
            <Field
              label="New password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Safe, and close to home.</h2>
          <p>
            Your photographs stay on your own server. Originals keep their
            metadata. Studio exports remove private metadata.
          </p>
          <p>
            Make encrypted backups on another device. Your deployment guide
            includes backup, restore, and account recovery commands.
          </p>
          <p>
            On a phone, use your browser’s “Add to Home Screen” option over
            HTTPS to keep Ours close.
          </p>
        </section>
      </div>
    </Page>
  );
}
