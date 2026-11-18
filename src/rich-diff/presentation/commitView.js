// Markup for the commit diff: the commit header and the list of changed
// Markdown files beside the rendered diff. The host sends plain data; these
// helpers only turn it into escaped HTML.
import { escapeAttribute, escapeHtml } from "./htmlEscape.js";

const statusLetters = {
  added: "A",
  deleted: "D",
  modified: "M",
  renamed: "R",
};

const statusNames = {
  added: "Added",
  deleted: "Deleted",
  modified: "Modified",
  renamed: "Renamed",
};

export function normalizeCommitView(view) {
  if (!view || typeof view !== "object") return null;
  return {
    key: String(view.key || ""),
    title: String(view.title || ""),
    meta: Array.isArray(view.meta) ? view.meta.map(String).filter(Boolean) : [],
    note: String(view.note || ""),
    files: Array.isArray(view.files)
      ? view.files.map((file, index) => ({
          id: String(file.id ?? index),
          path: String(file.path || ""),
          oldPath: file.oldPath ? String(file.oldPath) : "",
          status: statusLetters[file.status] ? file.status : "modified",
          additions: Number.isFinite(file.additions) ? file.additions : null,
          deletions: Number.isFinite(file.deletions) ? file.deletions : null,
        }))
      : [],
  };
}

export function renderCommitFrame(view) {
  const meta = view.meta
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");
  return `
    <div class="rdiff-commit">
      <header class="rdiff-commit-header">
        <div class="rdiff-commit-info">
          <div class="rdiff-commit-title">${escapeHtml(view.title)}</div>
          ${meta ? `<div class="rdiff-commit-meta">${meta}</div>` : ""}
          ${view.note ? `<div class="rdiff-commit-note">${escapeHtml(view.note)}</div>` : ""}
        </div>
        <button type="button" class="rdiff-button" data-action="pick-commit">Select Commit…</button>
      </header>
      <div class="rdiff-commit-body">
        <nav class="rdiff-files" aria-label="Changed Markdown files">
          <div class="rdiff-files-heading">
            <span>Markdown files</span>
            <span class="rdiff-files-count">${view.files.length}</span>
          </div>
          <ul class="rdiff-file-list">
            ${view.files.map(renderFileItem).join("")}
          </ul>
        </nav>
        <div class="rdiff-commit-main"></div>
      </div>
    </div>
  `;
}

function renderFileItem(file) {
  const slash = file.path.lastIndexOf("/");
  const name = slash >= 0 ? file.path.slice(slash + 1) : file.path;
  const directory = slash >= 0 ? file.path.slice(0, slash) : "";
  const title = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
  return `
    <li>
      <button type="button" class="rdiff-file-item is-${file.status}" data-file-id="${escapeAttribute(file.id)}" title="${escapeAttribute(title)}">
        <span class="rdiff-file-status" title="${statusNames[file.status]}">${statusLetters[file.status]}</span>
        <span class="rdiff-file-text">
          <span class="rdiff-file-name">${escapeHtml(name)}</span>
          ${directory ? `<span class="rdiff-file-dir">${escapeHtml(directory)}</span>` : ""}
        </span>
        ${renderFileCounts(file)}
      </button>
    </li>
  `;
}

function renderFileCounts(file) {
  if (file.additions === null && file.deletions === null) return "";
  return `
    <span class="rdiff-file-counts">
      ${file.additions ? `<span class="rdiff-file-add">+${file.additions}</span>` : ""}
      ${file.deletions ? `<span class="rdiff-file-delete">-${file.deletions}</span>` : ""}
    </span>
  `;
}

export function updateFileSelection(container, selectedFileId) {
  container.querySelectorAll("[data-file-id]").forEach((item) => {
    const selected = item.dataset.fileId === selectedFileId;
    item.classList.toggle("is-selected", selected);
    if (selected) {
      item.setAttribute("aria-current", "true");
    } else {
      item.removeAttribute("aria-current");
    }
  });
}

export function renderStatusBadge(status) {
  if (!statusLetters[status]) return "";
  return `<span class="rdiff-status-badge is-${status}">${statusNames[status]}</span>`;
}

export function renderMessage(title, copy) {
  return `
    <div class="rdiff-empty">
      <div class="rdiff-empty-title">${escapeHtml(title)}</div>
      ${copy ? `<div class="rdiff-empty-copy">${escapeHtml(copy)}</div>` : ""}
    </div>
  `;
}
