"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, Send } from "lucide-react";
import { createBlogPost } from "../lib/crm-api";
import styles from "./blog-shell.module.css";

type BlogForm = {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  image: string;
  readingTime: string;
  publishedAt: string;
  relatedServiceSlug: string;
  keywords: string;
  youtubeEmbedUrl: string;
  content: string;
  published: boolean;
};

const initialForm: BlogForm = {
  title: "",
  slug: "",
  category: "",
  excerpt: "",
  image: "",
  readingTime: "",
  publishedAt: new Date().toISOString().slice(0, 16),
  relatedServiceSlug: "",
  keywords: "",
  youtubeEmbedUrl: "",
  content: "",
  published: false,
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toYoutubeEmbedUrl(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v") ?? "";
      } else {
        const [format, id] = url.pathname.split("/").filter(Boolean);
        videoId = ["embed", "shorts", "live"].includes(format) ? id ?? "" : "";
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null;
  } catch {
    return null;
  }
}

export function BlogShell() {
  const [form, setForm] = useState<BlogForm>(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const contentStats = useMemo(() => {
    const words = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;
    const headings = form.content.split("\n").filter((line) => /^##\s+/.test(line.trim())).length;
    return { words, headings };
  }, [form.content]);

  const youtubePreviewUrl = useMemo(
    () => toYoutubeEmbedUrl(form.youtubeEmbedUrl),
    [form.youtubeEmbedUrl]
  );

  function updateField<Key extends keyof BlogForm>(key: Key, value: BlogForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      slug: current.slug || slugify(title),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setCreatedSlug(null);

    if (!form.title.trim() || !form.slug.trim() || !form.excerpt.trim() || !form.youtubeEmbedUrl.trim() || !form.content.trim()) {
      setFeedback("Add a title, slug, excerpt, YouTube video, and article content before saving.");
      return;
    }

    if (!youtubePreviewUrl) {
      setFeedback("Use a valid YouTube video URL (youtube.com, youtu.be, Shorts, or an embed URL).");
      return;
    }

    setIsSaving(true);

    try {
      const response = await createBlogPost({
        title: form.title.trim(),
        slug: slugify(form.slug),
        category: form.category.trim(),
        excerpt: form.excerpt.trim(),
        image: form.image.trim(),
        readingTime: form.readingTime.trim(),
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined,
        relatedServiceSlug: form.relatedServiceSlug.trim(),
        keywords: form.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
        youtubeEmbedUrl: form.youtubeEmbedUrl.trim(),
        content: form.content.trim(),
        published: form.published,
      });

      setCreatedSlug(response.post.slug);
      setFeedback(form.published ? "Post published and ready for the website." : "Draft saved successfully.");
      setForm((current) => ({ ...initialForm, publishedAt: current.publishedAt }));
    } catch (error) {
      console.error("[blog-shell] failed to save post:", error);
      setFeedback(error instanceof Error ? error.message : "We could not save this post yet.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.backLink}><ArrowLeft size={16} /> Back to tools</Link>
          <p className={styles.eyebrow}>Smart Tax Returns · Content studio</p>
          <h1>Smart Blog</h1>
          <p>Create a draft or publish an article directly to the website&apos;s blog feed.</p>
        </div>
        <a className={styles.websiteLink} href="https://www.smarttaxreturns.com" target="_blank" rel="noreferrer">
          Open website <ExternalLink size={16} />
        </a>
      </header>

      {feedback && (
        <div className={styles.feedback} role="status">
          <CheckCircle2 size={18} /> {feedback}
          {createdSlug && <span>Slug: <strong>{createdSlug}</strong></span>}
        </div>
      )}

      <form className={styles.editor} onSubmit={submit}>
        <section className={styles.mainFields}>
          <label className={styles.fullWidth}>
            Article title <span>*</span>
            <input value={form.title} onChange={(event) => updateTitle(event.target.value)} placeholder="Example: How to prepare for tax season" />
          </label>

          <label className={styles.fullWidth}>
            URL slug <span>*</span>
            <input value={form.slug} onChange={(event) => updateField("slug", slugify(event.target.value))} placeholder="how-to-prepare-for-tax-season" />
            <small>Lowercase URL identifier. It cannot be changed after publication.</small>
          </label>

          <div className={styles.twoColumns}>
            <label>
              Category
              <input value={form.category} onChange={(event) => updateField("category", event.target.value)} placeholder="Tax tips" />
            </label>
            <label>
              Reading time
              <input value={form.readingTime} onChange={(event) => updateField("readingTime", event.target.value)} placeholder="6 min read" />
            </label>
          </div>

          <label className={styles.fullWidth}>
            Excerpt <span>*</span>
            <textarea rows={3} value={form.excerpt} onChange={(event) => updateField("excerpt", event.target.value)} placeholder="Short summary used on the blog listing and search previews." />
          </label>

          <label className={styles.fullWidth}>
            Article content <span>*</span>
            <textarea className={styles.contentField} value={form.content} onChange={(event) => updateField("content", event.target.value)} placeholder={"Use plain text. Add ## before a line to make it an H2 section.\n\nExample:\n## Documents you need\nBring your income statements and ID."} />
            <small>{contentStats.words} words · {contentStats.headings} H2 section{contentStats.headings === 1 ? "" : "s"}</small>
          </label>
        </section>

        <aside className={styles.sideFields}>
          <div className={styles.sideTitle}><FileText size={18} /> Publishing details</div>
          <label>
            Cover image URL
            <input type="url" value={form.image} onChange={(event) => updateField("image", event.target.value)} placeholder="https://..." />
          </label>
          <label>
            YouTube video URL <span>*</span>
            <input type="url" value={form.youtubeEmbedUrl} onChange={(event) => updateField("youtubeEmbedUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
            <small>Paste a YouTube, Shorts, youtu.be, or existing embed link.</small>
          </label>
          {youtubePreviewUrl && (
            <div className={styles.videoPreview}>
              <iframe src={youtubePreviewUrl} title="YouTube video preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}
          <label>
            Publish date
            <input type="datetime-local" value={form.publishedAt} onChange={(event) => updateField("publishedAt", event.target.value)} />
          </label>
          <label>
            Related service slug
            <input value={form.relatedServiceSlug} onChange={(event) => updateField("relatedServiceSlug", event.target.value)} placeholder="income-tax-preparation" />
          </label>
          <label>
            Keywords
            <input value={form.keywords} onChange={(event) => updateField("keywords", event.target.value)} placeholder="taxes, florida, IRS" />
            <small>Separate keywords with commas.</small>
          </label>
          <label className={styles.publishToggle}>
            <input type="checkbox" checked={form.published} onChange={(event) => updateField("published", event.target.checked)} />
            <span>
              <strong>Publish now</strong>
              <small>Make this post visible in the public blog API.</small>
            </span>
          </label>
          <button className={styles.saveButton} type="submit" disabled={isSaving}>
            <Send size={17} /> {isSaving ? "Saving..." : form.published ? "Publish post" : "Save draft"}
          </button>
        </aside>
      </form>
    </main>
  );
}
