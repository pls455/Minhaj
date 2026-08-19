import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* =========================================================
   BASIC HELPERS
========================================================= */

const $ = selector => document.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

const esc = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const arr = value =>
  Array.isArray(value)
    ? value
    : (value ? [value] : []);

const roleLevel = {
  reviewer: 1,
  content_admin: 2,
  superadmin: 3,
  super_admin: 3,
  admin: 3
};

let role = null;

let editing = {
  branch: null,
  subject: null,
  category: null,
  resource: null,
  foundation: null
};

let data = {
  branches: [],
  subjects: [],
  categories: [],
  resources: [],
  foundations: [],
  suggestions: [],
  logs: [],
  admins: [],
  templates: []
};

const cache = name => data[name] || [];

const can = requiredRole =>
  (roleLevel[role] || 0) >= (roleLevel[requiredRole] || 0);

const errorText = error =>
  error?.code ||
  error?.message ||
  "حدث خطأ غير معروف.";

const msg = (element, text, error = false) => {
  if (!element) return;

  element.textContent = text || "";
  element.className = error
    ? "message error"
    : "message success";
};

const slug = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const normalizeUrl = value => {
  try {
    const url = new URL(String(value || "").trim());

    url.hash = "";

    if (
      url.pathname.length > 1 &&
      url.pathname.endsWith("/")
    ) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString().toLowerCase();

  } catch {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "")
      .toLowerCase();
  }
};


/* =========================================================
   DATA HELPERS
========================================================= */

const branchName = id => {
  const item = cache("branches").find(
    x =>
      x.id === id ||
      x.stableId === id
  );

  return item?.name || id || "غير محدد";
};

const categoryName = id => {
  const item = cache("categories").find(
    x =>
      x.id === id ||
      x.stableId === id
  );

  return item?.name || id || "غير مصنف";
};

const subjectName = id => {
  const item = cache("subjects").find(
    x =>
      x.id === id ||
      x.stableId === id
  );

  return item?.name || id || "غير محدد";
};

const branchesOfSubject = subject => {
  if (!subject) return [];

  return arr(subject.branchIds).length
    ? arr(subject.branchIds)
    : arr(subject.branchId);
};

const branchesOf = item => {
  if (!item) return [];

  return arr(item.branchIds).length
    ? arr(item.branchIds)
    : arr(item.branchId);
};


/* =========================================================
   FIRESTORE
========================================================= */

async function all(name, max = 500) {
  const snapshot = await getDocs(
    query(
      collection(db, name),
      limit(max)
    )
  );

  return snapshot.docs.map(document => ({
    id: document.id,
    ...document.data()
  }));
}


/*
 * مهم جدًا:
 * لا نخلي Promise واحد فاشل يسقط كامل لوحة الإدارة.
 */
async function safeAll(name, max = 500) {
  try {
    const result = await all(name, max);

    return {
      ok: true,
      data: result,
      error: null
    };

  } catch (error) {
    console.error(
      `[Firestore] Failed loading ${name}:`,
      error
    );

    return {
      ok: false,
      data: [],
      error
    };
  }
}


async function loadSuggestions() {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "suggestions"),
        where("status", "==", "pending"),
        limit(300)
      )
    );

    return {
      ok: true,
      data: snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      })),
      error: null
    };

  } catch (error) {
    console.error(
      "[Firestore] Failed loading suggestions:",
      error
    );

    return {
      ok: false,
      data: [],
      error
    };
  }
}


/* =========================================================
   ADMIN LOGS
========================================================= */

async function nowLog(
  action,
  collectionName,
  targetId,
  details = ""
) {
  try {

    await addDoc(
      collection(db, "adminLogs"),
      {
        action: String(action || ""),
        collection: String(collectionName || ""),
        targetId: String(targetId || ""),
        details: String(details || ""),
        adminUid: auth.currentUser?.uid || "",
        adminEmail: auth.currentUser?.email || "",
        role: role || "",
        createdAt: serverTimestamp()
      }
    );

  } catch (error) {
    console.warn(
      "[adminLogs] Failed:",
      error
    );
  }
}


/* =========================================================
   DEFAULT DATA
========================================================= */

async function ensureDefaults() {

  if (role !== "superadmin") {
    return;
  }

  const branchDefaults = [
    {
      id: "scientific",
      name: "العلمي",
      stableId: "scientific",
      icon: "🔬",
      order: 1,
      active: true,
      description: "الفرع العلمي"
    },
    {
      id: "literary",
      name: "الأدبي",
      stableId: "literary",
      icon: "📚",
      order: 2,
      active: true,
      description: "الفرع الأدبي"
    },
    {
      id: "industrial",
      name: "الصناعي",
      stableId: "industrial",
      icon: "⚙️",
      order: 3,
      active: true,
      description: "الفرع الصناعي"
    }
  ];

  const categoryDefaults = [
    {
      id: "books",
      name: "كتب",
      stableId: "books",
      icon: "📚",
      order: 1,
      active: true,
      description: "كتب ومراجع"
    },
    {
      id: "summaries",
      name: "ملخصات",
      stableId: "summaries",
      icon: "📝",
      order: 2,
      active: true,
      description: "ملخصات ومراجعات"
    },
    {
      id: "solutions",
      name: "حلول",
      stableId: "solutions",
      icon: "✅",
      order: 3,
      active: true,
      description: "حلول وأسئلة"
    },
    {
      id: "exams",
      name: "اختبارات",
      stableId: "exams",
      icon: "🧪",
      order: 4,
      active: true,
      description: "اختبارات ونماذج"
    },
    {
      id: "worksheets",
      name: "دوسيات",
      stableId: "worksheets",
      icon: "📖",
      order: 5,
      active: true,
      description: "دوسيات وملفات"
    }
  ];

  try {

    const [
      branchesSnapshot,
      categoriesSnapshot
    ] = await Promise.all([
      getDocs(collection(db, "branches")),
      getDocs(collection(db, "categories"))
    ]);

    const batch = writeBatch(db);

    const existingBranches =
      new Set(
        branchesSnapshot.docs.map(
          document => document.id
        )
      );

    const existingCategories =
      new Set(
        categoriesSnapshot.docs.map(
          document => document.id
        )
      );

    let changed = false;

    for (const item of branchDefaults) {

      if (!existingBranches.has(item.id)) {

        batch.set(
          doc(db, "branches", item.id),
          {
            ...item,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
        );

        changed = true;
      }
    }

    for (const item of categoryDefaults) {

      if (!existingCategories.has(item.id)) {

        batch.set(
          doc(db, "categories", item.id),
          {
            ...item,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
        );

        changed = true;
      }
    }

    if (changed) {
      await batch.commit();
    }

  } catch (error) {

    console.warn(
      "[Defaults] Failed:",
      error
    );
  }
}


async function ensureStableIds() {

  if (role !== "superadmin") {
    return;
  }

  try {

    const [
      branchesSnapshot,
      subjectsSnapshot,
      categoriesSnapshot
    ] = await Promise.all([
      getDocs(collection(db, "branches")),
      getDocs(collection(db, "subjects")),
      getDocs(collection(db, "categories"))
    ]);

    const batch = writeBatch(db);

    let changed = false;

    for (
      const snapshot of [
        branchesSnapshot,
        subjectsSnapshot,
        categoriesSnapshot
      ]
    ) {

      for (const document of snapshot.docs) {

        const item = document.data();

        if (!item.stableId) {

          batch.update(
            document.ref,
            {
              stableId:
                slug(item.name) ||
                document.id,

              updatedAt:
                serverTimestamp()
            }
          );

          changed = true;
        }
      }
    }

    if (changed) {
      await batch.commit();
    }

  } catch (error) {

    console.warn(
      "[Stable IDs] Failed:",
      error
    );
  }
}


/* =========================================================
   LOAD ALL
========================================================= */

async function loadAll() {

  /*
   * لا نوقف التحميل بسبب defaults/stable IDs.
   */
  try {
    await ensureDefaults();
  } catch (error) {
    console.warn(error);
  }

  try {
    await ensureStableIds();
  } catch (error) {
    console.warn(error);
  }


  const [
    branchesResult,
    subjectsResult,
    categoriesResult,
    resourcesResult,
    foundationsResult,
    suggestionsResult
  ] = await Promise.all([

    safeAll("branches"),

    safeAll("subjects"),

    safeAll("categories"),

    safeAll("resources"),

    safeAll("foundations"),

    loadSuggestions()
  ]);


  data = {
    ...data,

    branches: branchesResult.data,
    subjects: subjectsResult.data,
    categories: categoriesResult.data,
    resources: resourcesResult.data,
    foundations: foundationsResult.data,
    suggestions: suggestionsResult.data
  };


  const failed = [];

  if (!branchesResult.ok) {
    failed.push("branches");
  }

  if (!subjectsResult.ok) {
    failed.push("subjects");
  }

  if (!categoriesResult.ok) {
    failed.push("categories");
  }

  if (!resourcesResult.ok) {
    failed.push("resources");
  }

  if (!foundationsResult.ok) {
    failed.push("foundations");
  }

  if (!suggestionsResult.ok) {
    failed.push("suggestions");
  }


  if (can("content_admin")) {

    let admins = [];
    let logs = [];
    let templates = [];


    /*
     * admins و adminLogs فقط للسوبر أدمن.
     */
    if (role === "superadmin") {

      const [
        adminsResult,
        logsResult
      ] = await Promise.all([
        safeAll("admins"),
        safeAll("adminLogs", 100)
      ]);

      admins = adminsResult.data;

      logs = logsResult.data.sort(
        (a, b) =>
          (b.createdAt?.seconds || 0) -
          (a.createdAt?.seconds || 0)
      );

      if (!adminsResult.ok) {
        failed.push("admins");
      }

      if (!logsResult.ok) {
        failed.push("adminLogs");
      }
    }


    /*
     * القوالب متاحة لـ Content Admin وما فوق.
     */
    const templatesResult =
      await safeAll("templates", 100);

    templates = templatesResult.data;

    if (!templatesResult.ok) {
      failed.push("templates");
    }


    data = {
      ...data,
      admins,
      logs,
      templates
    };

  } else {

    data = {
      ...data,
      admins: [],
      logs: [],
      templates: []
    };
  }


  render();


  const uniqueFailed =
    [...new Set(failed)];


  if (uniqueFailed.length) {

    const text =
      `تم تحميل اللوحة، لكن تعذر تحميل: ${uniqueFailed.join("، ")}.`;

    msg(
      $("#dashboardMsg"),
      text,
      true
    );

    console.error(
      "Firestore collections failed:",
      uniqueFailed
    );

  } else {

    msg(
      $("#dashboardMsg"),
      "تم تحميل لوحة الإدارة بنجاح."
    );
  }
}


/* =========================================================
   FORM HELPERS
========================================================= */

function optionHTML(
  items,
  valueField = "id",
  labelField = "name",
  selected = ""
) {

  return items
    .filter(item => item.active !== false)
    .slice()
    .sort(
      (a, b) =>
        (a.order ?? 9999) -
        (b.order ?? 9999) ||
        String(a[labelField] || "")
          .localeCompare(
            String(b[labelField] || ""),
            "ar"
          )
    )
    .map(
      item =>
        `<option
          value="${esc(item[valueField])}"
          ${
            item[valueField] === selected
              ? "selected"
              : ""
          }
        >
          ${esc(item[labelField])}
        </option>`
    )
    .join("");
}


function checks(
  container,
  items,
  selected = []
) {

  if (!container) return;

  container.innerHTML =
    items
      .filter(item => item.active !== false)
      .slice()
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        item =>
          `<label>
            <input
              type="checkbox"
              value="${esc(item.id)}"
              ${
                selected.includes(item.id)
                  ? "checked"
                  : ""
              }
            >
            ${esc(item.name)}
          </label>`
      )
      .join("");
}


function checked(container) {

  if (!container) {
    return [];
  }

  return $$(
    'input[type="checkbox"]:checked',
    container
  ).map(
    input => input.value
  );
}


function fillChecks(
  container,
  ids
) {

  if (!container) return;

  const selected =
    arr(ids);

  $$(
    'input[type="checkbox"]',
    container
  ).forEach(input => {

    input.checked =
      selected.includes(input.value);
  });
}


function documentId(
  id,
  stable
) {

  return `
    <p class="admin-doc-id">
      <strong>Document ID:</strong>
      <code>${esc(id)}</code>

      ${
        stable
          ? `
            ·
            <strong>Stable ID:</strong>
            <code>${esc(stable)}</code>
          `
          : ""
      }

      <button
        type="button"
        class="btn small"
        data-copy-id="${esc(id)}"
      >
        📋 نسخ ID
      </button>
    </p>
  `;
}


/* =========================================================
   TABS
========================================================= */

function openTab(name) {

  $$(".admin-tab").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.tab === name
    );
  });


  $$(".admin-panel").forEach(panel => {
    panel.classList.add("hidden");
  });


  $(`#${name}Panel`)
    ?.classList.remove("hidden");


  if (name === "templates") {
    renderTemplatePreview();
  }
}


/* =========================================================
   RENDER
========================================================= */

function render() {

  if ($("#branchesCount")) {
    $("#branchesCount").textContent =
      cache("branches").length;
  }

  if ($("#subjectsCount")) {
    $("#subjectsCount").textContent =
      cache("subjects").length;
  }

  if ($("#resourcesCount")) {
    $("#resourcesCount").textContent =
      cache("resources").length;
  }

  if ($("#categoriesCount")) {
    $("#categoriesCount").textContent =
      cache("categories").length;
  }

  if ($("#suggestionsCount")) {
    $("#suggestionsCount").textContent =
      cache("suggestions").length;
  }

  if ($("#logsCount")) {
    $("#logsCount").textContent =
      cache("logs").length;
  }


  $$(".super-only").forEach(element => {

    element.classList.toggle(
      "hidden",
      role !== "superadmin"
    );
  });


  renderBranches();
  renderSubjects();
  renderCategories();
  renderResources();
  renderFoundations();
  renderSuggestions();
  renderLogs();
  renderAdmins();
  renderTemplates();
  renderFormsOptions();


  if ($("#overviewCards")) {

    $("#overviewCards").innerHTML = [

      [
        "🌿",
        "الفروع",
        data.branches.length,
        "branches"
      ],

      [
        "📚",
        "المواد",
        data.subjects.length,
        "subjects"
      ],

      [
        "🗂️",
        "التصنيفات",
        data.categories.length,
        "categories"
      ],

      [
        "🔗",
        "المصادر",
        data.resources.length,
        "resources"
      ]

    ]
      .map(
        item =>
          `
          <button
            class="stat-box"
            data-tabjump="${item[3]}"
          >
            <span>
              ${item[0]} ${item[1]}
            </span>

            <strong>
              ${item[2]}
            </strong>
          </button>
          `
      )
      .join("");
  }


  if ($("#recentSuggestions")) {

    $("#recentSuggestions").innerHTML =
      data.suggestions
        .slice(0, 5)
        .map(
          suggestion =>
            `
            <div class="admin-item">

              <div>
                <strong>
                  ${esc(suggestion.title)}
                </strong>

                <p>
                  اقتراح قيد المراجعة ·
                  ${esc(
                    suggestion.studentName ||
                    "طالب"
                  )}
                </p>
              </div>

              <button
                class="btn small"
                data-tabjump="suggestions"
              >
                مراجعة
              </button>

            </div>
            `
        )
        .join("") ||
      `
        <div class="empty">
          لا توجد اقتراحات معلقة.
        </div>
      `;
  }
}


/* =========================================================
   BRANCHES
========================================================= */

function renderBranches() {

  const element =
    $("#branchesList");

  if (!element) return;

  element.innerHTML =
    data.branches
      .slice()
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        branch =>
          `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(branch.icon || "🌿")}
                ${esc(branch.name)}
              </strong>

              <p>
                ${esc(branch.description || "")}
                ·
                ${
                  branch.active === false
                    ? "موقوف"
                    : "نشط"
                }
                · stableId:
                ${esc(
                  branch.stableId ||
                  branch.id
                )}
              </p>

              ${documentId(
                branch.id,
                branch.stableId
              )}

            </div>

            <div>

              <button
                class="btn small"
                data-edit-branch="${esc(branch.id)}"
              >
                تعديل
              </button>

              ${
                branch.active === false
                  ? `
                    <button
                      class="btn small"
                      data-toggle-branch="${esc(branch.id)}"
                    >
                      تفعيل
                    </button>
                  `
                  : `
                    <button
                      class="btn danger small"
                      data-toggle-branch="${esc(branch.id)}"
                    >
                      تعطيل
                    </button>
                  `
              }

            </div>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا توجد فروع.
      </div>
    `;
}


/* =========================================================
   SUBJECTS
========================================================= */

function renderSubjects() {

  const element =
    $("#subjectsList");

  if (!element) return;

  element.innerHTML =
    data.subjects
      .slice()
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        subject =>
          `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(subject.name)}
              </strong>

              <p>
                ${
                  branchesOf(subject)
                    .map(branchName)
                    .join("، ") ||
                  "بدون فرع"
                }

                ·

                ${
                  branchesOf(subject).length > 1
                    ? "مادة مشتركة"
                    : "مادة لفرع واحد"
                }
              </p>

              ${documentId(
                subject.id,
                subject.stableId
              )}

            </div>

            <div>

              <button
                class="btn small"
                data-edit-sub="${esc(subject.id)}"
              >
                تعديل
              </button>

              <button
                class="btn danger small"
                data-del-sub="${esc(subject.id)}"
              >
                حذف
              </button>

            </div>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا توجد مواد.
      </div>
    `;
}


/* =========================================================
   CATEGORIES
========================================================= */

function renderCategories() {

  const element =
    $("#categoriesList");

  if (!element) return;

  element.innerHTML =
    data.categories
      .slice()
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        category =>
          `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(
                  category.icon ||
                  "🗂️"
                )}
                ${esc(category.name)}
              </strong>

              <p>
                ${esc(
                  category.description ||
                  ""
                )}
                ·
                ${
                  category.active === false
                    ? "موقوف"
                    : "نشط"
                }
              </p>

              ${documentId(
                category.id,
                category.stableId
              )}

            </div>

            <div>

              <button
                class="btn small"
                data-edit-cat="${esc(category.id)}"
              >
                تعديل
              </button>

              <button
                class="btn danger small"
                data-del-cat="${esc(category.id)}"
              >
                حذف
              </button>

            </div>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا توجد تصنيفات.
      </div>
    `;
}


/* =========================================================
   RESOURCES
========================================================= */

function renderResources() {

  const element =
    $("#resourcesList");

  if (!element) return;

  element.innerHTML =
    data.resources
      .slice()
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(resource => {

        const subject =
          data.subjects.find(
            subject =>
              subject.id ===
              resource.subjectId ||
              subject.stableId ===
              resource.subjectId
          );

        const resourceBranches =
          branchesOf(resource).length
            ? branchesOf(resource)
            : branchesOfSubject(subject);

        const category =
          resource.categoryId
            ? categoryName(
                resource.categoryId
              )
            : (
                resource.category ||
                "غير مصنف"
              );

        return `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(resource.title)}
              </strong>

              <p>

                📚
                ${esc(
                  subjectName(
                    resource.subjectId
                  )
                )}

                ·

                ${
                  resourceBranches
                    .map(branchName)
                    .join("، ") ||
                  "بدون فرع"
                }

                ·

                ${esc(category)}

                ·

                ${
                  resource.active === false
                    ? "موقوف"
                    : "نشط"
                }

                ·

                ${
                  resource.url
                    ? `
                      <a
                        href="${esc(resource.url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        الرابط
                      </a>
                    `
                    : ""
                }

              </p>

              ${documentId(
                resource.id,
                resource.stableId
              )}

            </div>

            <div>

              <button
                class="btn small"
                data-edit-res="${esc(resource.id)}"
              >
                تعديل
              </button>

              <button
                class="btn danger small"
                data-del-res="${esc(resource.id)}"
              >
                حذف
              </button>

            </div>

          </div>
        `;
      })
      .join("") ||
    `
      <div class="empty">
        لا توجد مصادر.
      </div>
    `;
}


/* =========================================================
   FOUNDATIONS
========================================================= */

function renderFoundations() {

  const element =
    $("#foundationsList");

  if (!element) return;

  element.innerHTML =
    data.foundations
      .slice()
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        foundation =>
          `
          <div class="admin-item">

            <div>

              <strong>
                🧠
                ${esc(foundation.title)}
              </strong>

              <p>

                📚
                ${esc(
                  subjectName(
                    foundation.subjectId
                  )
                )}

                ·

                ${
                  branchesOf(foundation)
                    .map(branchName)
                    .join("، ") ||
                  "بدون فرع"
                }

                ·

                ${esc(
                  foundation.level ||
                  ""
                )}

                ·

                ${esc(
                  foundation.type ||
                  ""
                )}

                ·

                ${
                  foundation.url
                    ? `
                      <a
                        href="${esc(foundation.url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        الرابط
                      </a>
                    `
                    : ""
                }

              </p>

              ${documentId(
                foundation.id,
                foundation.stableId
              )}

            </div>

            <div>

              <button
                class="btn small"
                data-edit-found="${esc(foundation.id)}"
              >
                تعديل
              </button>

              <button
                class="btn danger small"
                data-del-found="${esc(foundation.id)}"
              >
                حذف
              </button>

            </div>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا يوجد تأسيس.
      </div>
    `;
}


/* =========================================================
   SUGGESTIONS
========================================================= */

function renderSuggestions() {

  const element =
    $("#suggestionsList");

  if (!element) return;

  element.innerHTML =
    data.suggestions
      .map(
        suggestion =>
          `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(suggestion.title)}
              </strong>

              <p>

                ${
                  suggestion.contentType ===
                  "foundation"
                    ? "🧠 تأسيس"
                    : "📚 مصدر"
                }

                ·

                ${
                  branchesOf(suggestion)
                    .map(branchName)
                    .join("، ") ||
                  "بدون فرع"
                }

                ·

                ${esc(
                  subjectName(
                    suggestion.subjectId
                  )
                )}

                ·

                ${esc(
                  suggestion.studentName ||
                  "طالب"
                )}

              </p>

              ${
                suggestion.url
                  ? `
                    <a
                      href="${esc(suggestion.url)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      فتح الرابط
                    </a>
                  `
                  : ""
              }

            </div>

            <div>

              <button
                class="btn primary small"
                data-approve="${esc(suggestion.id)}"
              >
                ✅ موافقة
              </button>

              <button
                class="btn danger small"
                data-reject="${esc(suggestion.id)}"
              >
                ❌ رفض
              </button>

            </div>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا توجد اقتراحات معلقة.
      </div>
    `;
}


/* =========================================================
   LOGS
========================================================= */

function renderLogs() {

  const element =
    $("#logsList");

  if (!element) return;

  if (role !== "superadmin") {
    element.innerHTML = "";
    return;
  }

  element.innerHTML =
    data.logs
      .map(
        log =>
          `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(log.action)}
                ·
                ${esc(log.collection || "")}
              </strong>

              <p>

                ${esc(log.details || "")}

                ·

                ${esc(
                  log.adminEmail ||
                  log.adminUid ||
                  "أدمن"
                )}

                ·

                ${
                  log.createdAt?.seconds
                    ? new Date(
                        log.createdAt.seconds *
                        1000
                      ).toLocaleString(
                        "ar-PS"
                      )
                    : "الآن"
                }

              </p>

            </div>

            <code>
              ${esc(
                log.targetId || ""
              )}
            </code>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا يوجد سجل بعد.
      </div>
    `;
}


/* =========================================================
   ADMINS
========================================================= */

function renderAdmins() {

  const element =
    $("#adminsList");

  if (!element) return;

  if (role !== "superadmin") {
    element.innerHTML = "";
    return;
  }

  element.innerHTML =
    data.admins
      .map(
        admin =>
          `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(
                  admin.email ||
                  admin.id
                )}
              </strong>

              <p>

                ${esc(
                  admin.role ||
                  "reviewer"
                )}

                ·

                ${
                  admin.active !== false
                    ? "نشط"
                    : "موقوف"
                }

                · UID:

                ${esc(admin.id)}

              </p>

            </div>

            <button
              class="btn small"
              data-edit-admin="${esc(admin.id)}"
            >
              تعديل
            </button>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا يوجد أدمن.
      </div>
    `;
}


/* =========================================================
   SYSTEM REFERENCE
========================================================= */

function systemReference() {

  return {

    branches:
      data.branches.map(
        branch => ({
          branchId:
            branch.stableId ||
            branch.id,

          name:
            branch.name,

          active:
            branch.active !== false
        })
      ),

    subjects:
      data.subjects.map(
        subject => ({
          subjectId:
            subject.stableId ||
            subject.id,

          name:
            subject.name,

          branchIds:
            branchesOfSubject(subject)
              .map(
                id =>
                  data.branches.find(
                    branch =>
                      branch.id === id
                  )?.stableId ||
                  id
              ),

          active:
            subject.active !== false
        })
      ),

    categories:
      data.categories.map(
        category => ({
          categoryId:
            category.stableId ||
            category.id,

          name:
            category.name,

          active:
            category.active !== false
        })
      )
  };
}


/* =========================================================
   GENERAL TEMPLATE
========================================================= */

function buildGeneralTemplate() {

  return {

    templateType:
      "minhaj-general-v4",

    title:
      "قالب منهاج العام لإضافة المحتوى",

    purpose:
      "انسخ هذا القالب كاملًا إلى GPT، ثم أرسل بعده معلومات المحتوى أو الروابط. يجب على GPT إرجاع JSON فقط وفق schema المحدد.",

    systemReference:
      systemReference(),

    input: {
      content:
        "ضع هنا النص أو الروابط أو البيانات التي تريد استخراج المحتوى منها"
    },

    output: {

      resources: [
        {
          title: "",
          url: "",
          description: "",
          type: "",
          keywords: [],
          author: "",
          branchIds: [],
          subjectId: "",
          categoryId: "",
          order: 9999,
          active: true
        }
      ],

      foundations: [
        {
          title: "",
          url: "",
          description: "",
          type: "lesson",
          level: "beginner",
          keywords: [],
          author: "",
          branchIds: [],
          subjectId: "",
          order: 9999,
          active: true
        }
      ]
    },

    rules: [

      "أعد JSON صالحًا فقط ولا تضع Markdown أو شرحًا خارج JSON.",

      "استخدم IDs الموجودة في systemReference فقط، ولا تخترع أي ID.",

      "طابق أسماء الفرع والمادة والتصنيف مع systemReference ثم استخدم الـ ID المطابق.",

      "branchIds يجب أن تحتوي IDs الفروع فقط.",

      "subjectId يجب أن يكون ID مادة.",

      "categoryId يجب أن يكون ID تصنيف.",

      "العنوان والرابط مطلوبان للمصادر والتأسيس.",

      "لا تخترع روابط أو معلومات غير موجودة في المدخل.",

      "إذا تعذر تحديد المادة أو الفرع أو التصنيف فلا تخمّن.",

      "إذا كانت معلومة أساسية ناقصة أضف المشكلة إلى validationErrors.",

      "لا تستخدم أسماء بدل IDs في الحقول branchIds وsubjectId وcategoryId.",

      "إذا كان المصدر مشتركًا بين أكثر من فرع، ضع جميع الفروع في branchIds.",

      "لا تكرر نفس الرابط أكثر من مرة."
    ],

    responseSchema: {
      resources: "array",
      foundations: "array",
      validationErrors: "array"
    }
  };
}


/* =========================================================
   CUSTOM TEMPLATE
========================================================= */

const FIELD_DEFS = {

  title: {
    label: "العنوان",
    value: ""
  },

  url: {
    label: "الرابط",
    value: ""
  },

  description: {
    label: "الوصف",
    value: ""
  },

  type: {
    label: "النوع",
    value: ""
  },

  level: {
    label: "المستوى",
    value: "beginner"
  },

  keywords: {
    label: "الكلمات المفتاحية",
    value: []
  },

  author: {
    label: "المؤلف",
    value: ""
  },

  order: {
    label: "الترتيب",
    value: 9999
  },

  active: {
    label: "نشط",
    value: true
  },

  branchIds: {
    label: "الفروع",
    value: []
  },

  subjectId: {
    label: "المادة",
    value: ""
  },

  categoryId: {
    label: "التصنيف",
    value: ""
  }
};


function selectedTemplateFields() {

  return $$(
    "#customTemplateFields input[type='checkbox']:checked"
  ).map(
    input => input.value
  );
}


function buildCustomTemplate() {

  const collectionName =
    $("#customTemplateCollection")
      ?.value ||
    "resources";

  const fields =
    selectedTemplateFields();

  const item = {};

  for (const field of fields) {

    item[field] =
      FIELD_DEFS[field]?.value ??
      "";
  }


  /*
   * الحقول المرجعية المهمة يجب أن تظهر
   * حتى لو لم يتم اختيارها يدويًا.
   */
  if (collectionName === "resources") {

    if (!fields.includes("branchIds")) {
      item.branchIds = [];
    }

    if (!fields.includes("subjectId")) {
      item.subjectId = "";
    }

    if (!fields.includes("categoryId")) {
      item.categoryId = "";
    }
  }


  if (collectionName === "foundations") {

    if (!fields.includes("branchIds")) {
      item.branchIds = [];
    }

    if (!fields.includes("subjectId")) {
      item.subjectId = "";
    }
  }


  return {

    templateType:
      "minhaj-custom-v3",

    name:
      $("#customTemplateName")
        ?.value
        .trim() ||
      "قالب مخصص",

    target:
      collectionName,

    description:
      $("#customTemplateDescription")
        ?.value
        .trim() ||
      "",

    systemReference:
      systemReference(),

    input: {
      content:
        "ضع هنا المحتوى المراد تحويله"
    },

    fields,

    itemTemplate:
      item,

    output: {
      items: [
        item
      ],

      validationErrors: []
    },

    instructions: [

      "أعد JSON صالحًا فقط.",

      "لا تضع Markdown خارج JSON.",

      "لا تخترع روابط أو معلومات غير موجودة.",

      "استخدم systemReference لمطابقة الفرع والمادة والتصنيف.",

      "استخدم branchIds للفرع أو الفروع.",

      "استخدم subjectId للمادة.",

      "استخدم categoryId للتصنيف عند إنشاء مصدر.",

      "لا تخترع IDs.",

      "إذا كانت معلومة أساسية ناقصة أضفها إلى validationErrors.",

      "إذا كان المصدر مشتركًا بين أكثر من فرع، استخدم جميع branchIds.",

      "لا تكرر الروابط."
    ],

    responseSchema: {
      items: "array",
      validationErrors: "array"
    }
  };
}


function renderTemplatePreview() {

  const element =
    $("#templatePreview");

  if (!element) return;

  const mode =
    $("#templateMode")
      ?.value ||
    "general";

  const template =
    mode === "general"
      ? buildGeneralTemplate()
      : buildCustomTemplate();

  element.value =
    JSON.stringify(
      template,
      null,
      2
    );

  element.scrollTop = 0;
}


/* =========================================================
   COPY
========================================================= */

async function copyTextReliable(text) {

  if (!text) {
    return false;
  }

  try {

    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {

      await navigator.clipboard.writeText(
        text
      );

      return true;
    }

  } catch {}


  try {

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value = text;

    textarea.setAttribute(
      "readonly",
      ""
    );

    textarea.style.position =
      "fixed";

    textarea.style.opacity =
      "0";

    textarea.style.pointerEvents =
      "none";

    document.body.appendChild(
      textarea
    );

    textarea.focus();

    textarea.select();

    textarea.setSelectionRange(
      0,
      textarea.value.length
    );

    const success =
      document.execCommand(
        "copy"
      );

    textarea.remove();

    return success;

  } catch {

    return false;
  }
}


/* =========================================================
   TEMPLATES RENDER
========================================================= */

function renderTemplates() {

  const element =
    $("#savedTemplatesList");

  if (!element) return;

  if (!can("content_admin")) {
    element.innerHTML = "";
    return;
  }

  element.innerHTML =
    data.templates
      .map(
        template =>
          `
          <div class="admin-item">

            <div>

              <strong>
                🧩
                ${esc(
                  template.name ||
                  template.id
                )}
              </strong>

              <p>

                ${esc(
                  template.target ||
                  "resources"
                )}

                ·

                ${esc(
                  template.description ||
                  ""
                )}

              </p>

              ${documentId(
                template.id,
                ""
              )}

            </div>

            <div>

              <button
                class="btn small"
                data-load-template="${esc(template.id)}"
              >
                تحميل
              </button>

              <button
                class="btn danger small"
                data-del-template="${esc(template.id)}"
              >
                حذف
              </button>

            </div>

          </div>
          `
      )
      .join("") ||
    `
      <div class="empty">
        لا توجد قوالب مخصصة محفوظة.
      </div>
    `;
}


/* =========================================================
   FORM OPTIONS
========================================================= */

function renderFormsOptions() {

  checks(
    $("#subjectBranches"),
    data.branches
  );

  checks(
    $("#resourceBranches"),
    data.branches
  );

  checks(
    $("#foundationBranches"),
    data.branches
  );


  const subjectOptions =
    optionHTML(
      data.subjects
    );

  if ($("#resourceSubject")) {

    const current =
      $("#resourceSubject").value;

    $("#resourceSubject").innerHTML =
      `<option value="">
        المادة
      </option>` +
      subjectOptions;

    if (
      current &&
      data.subjects.some(
        subject =>
          subject.id === current
      )
    ) {
      $("#resourceSubject").value =
        current;
    }
  }


  if ($("#foundationSubject")) {

    const current =
      $("#foundationSubject").value;

    $("#foundationSubject").innerHTML =
      `<option value="">
        المادة
      </option>` +
      subjectOptions;

    if (
      current &&
      data.subjects.some(
        subject =>
          subject.id === current
      )
    ) {
      $("#foundationSubject").value =
        current;
    }
  }


  if ($("#resourceCategory")) {

    const current =
      $("#resourceCategory").value;

    $("#resourceCategory").innerHTML =
      `<option value="">
        التصنيف
      </option>` +
      optionHTML(
        data.categories
      );

    if (
      current &&
      data.categories.some(
        category =>
          category.id === current
      )
    ) {
      $("#resourceCategory").value =
        current;
    }
  }
}


/* =========================================================
   RESET FORMS
========================================================= */

function resetForm(name) {

  editing[name] = null;

  $(`#${name}Form`)
    ?.reset();

  if (name === "branch") {

    if ($("#branchActive")) {
      $("#branchActive").checked =
        true;
    }
  }

  if (name === "category") {

    if ($("#categoryActive")) {
      $("#categoryActive").checked =
        true;
    }
  }

  if (name === "resource") {

    if ($("#resourceActive")) {
      $("#resourceActive").checked =
        true;
    }
  }

  renderFormsOptions();
}


/* =========================================================
   BUTTON EVENTS
========================================================= */

$$(".admin-tab").forEach(
  button => {

    button.onclick = () => {

      if (
        button.classList.contains(
          "hidden"
        )
      ) {
        return;
      }

      openTab(
        button.dataset.tab
      );
    };
  }
);


document.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        "button"
      );

    if (!button) {
      return;
    }


    if (button.dataset.copyId) {

      const success =
        await copyTextReliable(
          button.dataset.copyId
        );

      msg(
        $("#loginMsg"),
        success
          ? "تم نسخ المعرف."
          : "تعذر نسخ المعرف."
      );

      return;
    }


    if (button.dataset.tabjump) {

      openTab(
        button.dataset.tabjump
      );

      return;
    }


    try {

      /* =========================
         BRANCH EDIT
      ========================= */

      if (
        button.dataset.editBranch
      ) {

        const branch =
          data.branches.find(
            item =>
              item.id ===
              button.dataset.editBranch
          );

        if (!branch) return;

        editing.branch =
          branch.id;

        $("#branchId").value =
          branch.stableId ||
          branch.id;

        $("#branchName").value =
          branch.name || "";

        $("#branchIcon").value =
          branch.icon || "";

        $("#branchOrder").value =
          branch.order ?? "";

        $("#branchActive").checked =
          branch.active !== false;

        $("#branchDescription").value =
          branch.description || "";

        $("#branchForm")
          ?.classList.remove(
            "hidden"
          );

        openTab("branches");

        return;
      }


      /* =========================
         BRANCH TOGGLE
      ========================= */

      if (
        button.dataset.toggleBranch
      ) {

        if (!can("superadmin")) {
          throw Error(
            "Super Admin فقط."
          );
        }

        const branch =
          data.branches.find(
            item =>
              item.id ===
              button.dataset.toggleBranch
          );

        if (!branch) return;

        const nextActive =
          branch.active === false;

        await updateDoc(
          doc(
            db,
            "branches",
            branch.id
          ),
          {
            active: nextActive,
            updatedAt:
              serverTimestamp()
          }
        );

        await nowLog(
          nextActive
            ? "تفعيل فرع"
            : "تعطيل فرع",
          "branches",
          branch.id,
          branch.name
        );

        await loadAll();

        return;
      }


      /* =========================
         SUBJECT EDIT
      ========================= */

      if (
        button.dataset.editSub
      ) {

        const subject =
          data.subjects.find(
            item =>
              item.id ===
              button.dataset.editSub
          );

        if (!subject) return;

        editing.subject =
          subject.id;

        $("#subjectId").value =
          subject.stableId ||
          subject.id;

        $("#subjectName").value =
          subject.name || "";

        $("#subjectOrder").value =
          subject.order ?? "";

        $("#subjectDescription").value =
          subject.description || "";

        renderFormsOptions();

        fillChecks(
          $("#subjectBranches"),
          branchesOfSubject(
            subject
          )
        );

        $("#subjectForm")
          ?.classList.remove(
            "hidden"
          );

        openTab("subjects");

        return;
      }


      /* =========================
         SUBJECT DELETE
      ========================= */

      if (
        button.dataset.delSub
      ) {

        if (!can("content_admin")) {
          throw Error(
            "ليس لديك صلاحية."
          );
        }

        if (
          !confirm(
            "حذف المادة؟"
          )
        ) {
          return;
        }

        await deleteDoc(
          doc(
            db,
            "subjects",
            button.dataset.delSub
          )
        );

        await nowLog(
          "حذف",
          "subjects",
          button.dataset.delSub,
          subjectName(
            button.dataset.delSub
          )
        );

        await loadAll();

        return;
      }


      /* =========================
         CATEGORY EDIT
      ========================= */

      if (
        button.dataset.editCat
      ) {

        const category =
          data.categories.find(
            item =>
              item.id ===
              button.dataset.editCat
          );

        if (!category) return;

        editing.category =
          category.id;

        $("#categoryId").value =
          category.stableId ||
          category.id;

        $("#categoryName").value =
          category.name || "";

        $("#categoryIcon").value =
          category.icon || "";

        $("#categoryOrder").value =
          category.order ?? "";

        $("#categoryActive").checked =
          category.active !== false;

        $("#categoryDescription").value =
          category.description || "";

        $("#categoryForm")
          ?.classList.remove(
            "hidden"
          );

        openTab("categories");

        return;
      }


      /* =========================
         CATEGORY DELETE
      ========================= */

      if (
        button.dataset.delCat
      ) {

        if (!can("superadmin")) {
          throw Error(
            "Super Admin فقط."
          );
        }

        if (
          !confirm(
            "حذف التصنيف؟ المصادر لن تُحذف، لكنها ستحتاج تصنيفًا آخر."
          )
        ) {
          return;
        }

        await deleteDoc(
          doc(
            db,
            "categories",
            button.dataset.delCat
          )
        );

        await nowLog(
          "حذف",
          "categories",
          button.dataset.delCat,
          categoryName(
            button.dataset.delCat
          )
        );

        await loadAll();

        return;
      }


      /* =========================
         RESOURCE EDIT
      ========================= */

      if (
        button.dataset.editRes
      ) {

        const resource =
          data.resources.find(
            item =>
              item.id ===
              button.dataset.editRes
          );

        if (!resource) return;

        editing.resource =
          resource.id;

        $("#resourceTitle").value =
          resource.title || "";

        $("#resourceUrl").value =
          resource.url || "";

        renderFormsOptions();

        $("#resourceSubject").value =
          resource.subjectId || "";

        $("#resourceCategory").value =
          resource.categoryId ||
          (
            data.categories.find(
              category =>
                category.name ===
                resource.category
            )?.id ||
            ""
          );

        fillChecks(
          $("#resourceBranches"),
          branchesOf(resource)
        );

        $("#resourceType").value =
          resource.type || "";

        $("#resourceKeywords").value =
          arr(
            resource.keywords
          ).join(", ");

        $("#resourceOrder").value =
          resource.order ?? "";

        $("#resourceActive").checked =
          resource.active !== false;

        $("#resourceDescription").value =
          resource.description || "";

        $("#resourceForm")
          ?.classList.remove(
            "hidden"
          );

        openTab("resources");

        return;
      }


      /* =========================
         RESOURCE DELETE
      ========================= */

      if (
        button.dataset.delRes
      ) {

        if (!can("content_admin")) {
          throw Error(
            "ليس لديك صلاحية."
          );
        }

        if (
          !confirm(
            "حذف المصدر؟"
          )
        ) {
          return;
        }

        await deleteDoc(
          doc(
            db,
            "resources",
            button.dataset.delRes
          )
        );

        await nowLog(
          "حذف",
          "resources",
          button.dataset.delRes,
          ""
        );

        await loadAll();

        return;
      }


      /* =========================
         FOUNDATION EDIT
      ========================= */

      if (
        button.dataset.editFound
      ) {

        const foundation =
          data.foundations.find(
            item =>
              item.id ===
              button.dataset.editFound
          );

        if (!foundation) return;

        editing.foundation =
          foundation.id;

        $("#foundationTitle").value =
          foundation.title || "";

        $("#foundationUrl").value =
          foundation.url || "";

        renderFormsOptions();

        $("#foundationSubject").value =
          foundation.subjectId || "";

        fillChecks(
          $("#foundationBranches"),
          branchesOf(
            foundation
          )
        );

        $("#foundationLevel").value =
          foundation.level ||
          "beginner";

        $("#foundationType").value =
          foundation.type ||
          "lesson";

        $("#foundationKeywords").value =
          arr(
            foundation.keywords
          ).join(", ");

        $("#foundationOrder").value =
          foundation.order ?? "";

        $("#foundationDescription").value =
          foundation.description || "";

        $("#foundationForm")
          ?.classList.remove(
            "hidden"
          );

        openTab("foundations");

        return;
      }


      /* =========================
         FOUNDATION DELETE
      ========================= */

      if (
        button.dataset.delFound
      ) {

        if (!can("content_admin")) {
          throw Error(
            "ليس لديك صلاحية."
          );
        }

        if (
          !confirm(
            "حذف التأسيس؟"
          )
        ) {
          return;
        }

        await deleteDoc(
          doc(
            db,
            "foundations",
            button.dataset.delFound
          )
        );

        await nowLog(
          "حذف",
          "foundations",
          button.dataset.delFound,
          ""
        );

        await loadAll();

        return;
      }


      /* =========================
         SUGGESTIONS
      ========================= */

      if (
        button.dataset.approve ||
        button.dataset.reject
      ) {

        if (!can("reviewer")) {
          throw Error(
            "ليس لديك صلاحية."
          );
        }

        const suggestion =
          data.suggestions.find(
            item =>
              item.id ===
              (
                button.dataset.approve ||
                button.dataset.reject
              )
          );

        if (!suggestion) return;

        const approved =
          !!button.dataset.approve;


        if (approved) {

          const targetCollection =
            suggestion.contentType ===
            "foundation"
              ? "foundations"
              : "resources";


          const copy =
            {
              ...suggestion
            };

          delete copy.id;
          delete copy.status;
          delete copy.reviewedAt;
          delete copy.reviewedBy;


          copy.createdAt =
            serverTimestamp();

          copy.updatedAt =
            serverTimestamp();


          if (
            targetCollection ===
            "resources"
          ) {

            copy.categoryId =
              copy.categoryId ||
              null;

            if (
              !arr(
                copy.branchIds
              ).length
            ) {

              const subject =
                data.subjects.find(
                  item =>
                    item.id ===
                    copy.subjectId
                );

              copy.branchIds =
                branchesOfSubject(
                  subject
                );
            }
          }


          await addDoc(
            collection(
              db,
              targetCollection
            ),
            copy
          );


          await nowLog(
            "اعتماد اقتراح",
            targetCollection,
            suggestion.id,
            suggestion.title
          );
        }


        await updateDoc(
          doc(
            db,
            "suggestions",
            suggestion.id
          ),
          {
            status:
              approved
                ? "approved"
                : "rejected",

            reviewedAt:
              serverTimestamp(),

            reviewedBy:
              auth.currentUser?.uid ||
              ""
          }
        );

        await loadAll();

        return;
      }


      /* =========================
         ADMIN EDIT
      ========================= */

      if (
        button.dataset.editAdmin
      ) {

        if (role !== "superadmin") {
          throw Error(
            "Super Admin فقط."
          );
        }

        const admin =
          data.admins.find(
            item =>
              item.id ===
              button.dataset.editAdmin
          );

        if (!admin) return;

        $("#adminUid").value =
          admin.id;

        $("#adminEmailInput").value =
          admin.email || "";

        $("#adminRole").value =
          admin.role ||
          "reviewer";

        $("#adminActive").checked =
          admin.active !== false;

        $("#adminForm")
          ?.classList.remove(
            "hidden"
          );

        openTab("admins");

        return;
      }


      /* =========================
         TEMPLATE LOAD
      ========================= */

      if (
        button.dataset.loadTemplate
      ) {

        if (!can("content_admin")) {
          throw Error(
            "ليس لديك صلاحية."
          );
        }

        const template =
          data.templates.find(
            item =>
              item.id ===
              button.dataset.loadTemplate
          );

        if (!template) return;


        $("#templateMode").value =
          "custom";

        $("#customTemplateEditor")
          ?.classList.remove(
            "hidden"
          );

        $("#customTemplateName").value =
          template.name || "";

        $("#customTemplateCollection").value =
          template.target ||
          "resources";

        $("#customTemplateDescription").value =
          template.description ||
          "";


        $$("#customTemplateFields input[type='checkbox']")
          .forEach(
            checkbox => {

              checkbox.checked =
                arr(
                  template.fields
                ).includes(
                  checkbox.value
                );
            }
          );


        renderTemplatePreview();

        openTab("templates");

        return;
      }


      /* =========================
         TEMPLATE DELETE
      ========================= */

      if (
        button.dataset.delTemplate
      ) {

        if (!can("content_admin")) {
          throw Error(
            "ليس لديك صلاحية."
          );
        }

        if (
          !confirm(
            "حذف القالب؟"
          )
        ) {
          return;
        }

        await deleteDoc(
          doc(
            db,
            "templates",
            button.dataset.delTemplate
          )
        );

        await nowLog(
          "حذف قالب",
          "templates",
          button.dataset.delTemplate,
          ""
        );

        await loadAll();

        return;
      }

    } catch (error) {

      console.error(
        "[Admin Action Error]",
        error
      );

      alert(
        errorText(error)
      );
    }
  }
);


/* =========================================================
   ADD / CANCEL BUTTONS
========================================================= */

$("#addBranchBtn")?.addEventListener(
  "click",
  () => {

    if (!can("superadmin")) {
      return alert(
        "Super Admin فقط."
      );
    }

    resetForm("branch");

    $("#branchForm")
      ?.classList.remove(
        "hidden"
      );
  }
);


$("#cancelBranch")?.addEventListener(
  "click",
  () => {

    $("#branchForm")
      ?.classList.add(
        "hidden"
      );

    resetForm("branch");
  }
);


$("#addSubjectBtn")?.addEventListener(
  "click",
  () => {

    if (!can("content_admin")) {
      return alert(
        "ليس لديك صلاحية."
      );
    }

    resetForm("subject");

    $("#subjectForm")
      ?.classList.remove(
        "hidden"
      );
  }
);


$("#cancelSubject")?.addEventListener(
  "click",
  () => {

    $("#subjectForm")
      ?.classList.add(
        "hidden"
      );

    resetForm("subject");
  }
);


$("#addCategoryBtn")?.addEventListener(
  "click",
  () => {

    if (!can("superadmin")) {
      return alert(
        "Super Admin فقط."
      );
    }

    resetForm("category");

    $("#categoryForm")
      ?.classList.remove(
        "hidden"
      );
  }
);


$("#cancelCategory")?.addEventListener(
  "click",
  () => {

    $("#categoryForm")
      ?.classList.add(
        "hidden"
      );

    resetForm("category");
  }
);


$("#addResourceBtn")?.addEventListener(
  "click",
  () => {

    if (!can("content_admin")) {
      return alert(
        "ليس لديك صلاحية."
      );
    }

    resetForm("resource");

    $("#resourceForm")
      ?.classList.remove(
        "hidden"
      );
  }
);


$("#cancelResource")?.addEventListener(
  "click",
  () => {

    $("#resourceForm")
      ?.classList.add(
        "hidden"
      );

    resetForm("resource");
  }
);


$("#addFoundationBtn")?.addEventListener(
  "click",
  () => {

    if (!can("content_admin")) {
      return alert(
        "ليس لديك صلاحية."
      );
    }

    resetForm("foundation");

    $("#foundationForm")
      ?.classList.remove(
        "hidden"
      );
  }
);


$("#cancelFoundation")?.addEventListener(
  "click",
  () => {

    $("#foundationForm")
      ?.classList.add(
        "hidden"
      );

    resetForm("foundation");
  }
);


$("#addAdminBtn")?.addEventListener(
  "click",
  () => {

    if (role !== "superadmin") {
      return alert(
        "Super Admin فقط."
      );
    }

    $("#adminForm")
      ?.classList.remove(
        "hidden"
      );
  }
);


$("#cancelAdmin")?.addEventListener(
  "click",
  () => {

    $("#adminForm")
      ?.classList.add(
        "hidden"
      );
  }
);


/* =========================================================
   BRANCH FORM
========================================================= */

$("#branchForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!can("superadmin")) {
      return;
    }

    const stable =
      slug(
        $("#branchId")?.value
      ) ||
      slug(
        $("#branchName")?.value
      );

    if (!stable) {

      return msg(
        $("#branchMsg"),
        "أدخل معرفًا ثابتًا أو اسمًا.",
        true
      );
    }


    const old =
      editing.branch;


    const payload = {

      name:
        $("#branchName")
          .value
          .trim(),

      icon:
        $("#branchIcon")
          .value
          .trim(),

      description:
        $("#branchDescription")
          .value
          .trim(),

      order:
        Number(
          $("#branchOrder")
            .value
        ) || 9999,

      active:
        $("#branchActive")
          .checked,

      stableId:
        stable
    };


    try {

      if (old) {

        await updateDoc(
          doc(
            db,
            "branches",
            old
          ),
          {
            ...payload,
            updatedAt:
              serverTimestamp()
          }
        );

      } else {

        await setDoc(
          doc(
            db,
            "branches",
            stable
          ),
          {
            ...payload,
            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          }
        );
      }


      await nowLog(
        old
          ? "تعديل فرع"
          : "إضافة فرع",
        "branches",
        old || stable,
        payload.name
      );


      msg(
        $("#branchMsg"),
        "تم حفظ الفرع بنجاح."
      );


      $("#branchForm")
        .classList.add(
          "hidden"
        );


      await loadAll();

    } catch (error) {

      msg(
        $("#branchMsg"),
        errorText(error),
        true
      );
    }
  }
);


/* =========================================================
   SUBJECT FORM
========================================================= */

$("#subjectForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!can("content_admin")) {
      return;
    }


    const branchIds =
      checked(
        $("#subjectBranches")
      );


    if (!branchIds.length) {

      return msg(
        $("#subjectMsg"),
        "اختر فرعًا واحدًا على الأقل.",
        true
      );
    }


    const stable =
      slug(
        $("#subjectId")
          .value
      ) ||
      slug(
        $("#subjectName")
          .value
      );


    if (!stable) {

      return msg(
        $("#subjectMsg"),
        "أدخل اسم المادة.",
        true
      );
    }


    const payload = {

      name:
        $("#subjectName")
          .value
          .trim(),

      branchIds,

      description:
        $("#subjectDescription")
          .value
          .trim(),

      order:
        Number(
          $("#subjectOrder")
            .value
        ) || 9999,

      stableId:
        stable
    };


    try {

      if (editing.subject) {

        await updateDoc(
          doc(
            db,
            "subjects",
            editing.subject
          ),
          {
            ...payload,
            updatedAt:
              serverTimestamp()
          }
        );

      } else {

        await setDoc(
          doc(
            db,
            "subjects",
            stable
          ),
          {
            ...payload,
            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          }
        );
      }


      await nowLog(
        editing.subject
          ? "تعديل مادة"
          : "إضافة مادة",

        "subjects",

        editing.subject ||
          stable,

        payload.name
      );


      msg(
        $("#subjectMsg"),
        "تم حفظ المادة بنجاح."
      );


      $("#subjectForm")
        .classList.add(
          "hidden"
        );


      await loadAll();

    } catch (error) {

      msg(
        $("#subjectMsg"),
        errorText(error),
        true
      );
    }
  }
);


/* =========================================================
   CATEGORY FORM
========================================================= */

$("#categoryForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!can("superadmin")) {
      return;
    }


    const stable =
      slug(
        $("#categoryId")
          .value
      ) ||
      slug(
        $("#categoryName")
          .value
      );


    if (!stable) {

      return msg(
        $("#categoryMsg"),
        "أدخل اسم التصنيف.",
        true
      );
    }


    const payload = {

      name:
        $("#categoryName")
          .value
          .trim(),

      icon:
        $("#categoryIcon")
          .value
          .trim(),

      description:
        $("#categoryDescription")
          .value
          .trim(),

      order:
        Number(
          $("#categoryOrder")
            .value
        ) || 9999,

      active:
        $("#categoryActive")
          .checked,

      stableId:
        stable
    };


    try {

      if (editing.category) {

        await updateDoc(
          doc(
            db,
            "categories",
            editing.category
          ),
          {
            ...payload,
            updatedAt:
              serverTimestamp()
          }
        );

      } else {

        await setDoc(
          doc(
            db,
            "categories",
            stable
          ),
          {
            ...payload,
            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          }
        );
      }


      await nowLog(
        editing.category
          ? "تعديل تصنيف"
          : "إضافة تصنيف",

        "categories",

        editing.category ||
          stable,

        payload.name
      );


      msg(
        $("#categoryMsg"),
        "تم حفظ التصنيف بنجاح."
      );


      $("#categoryForm")
        .classList.add(
          "hidden"
        );


      await loadAll();

    } catch (error) {

      msg(
        $("#categoryMsg"),
        errorText(error),
        true
      );
    }
  }
);


/* =========================================================
   RESOURCE FORM
========================================================= */

$("#resourceForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!can("content_admin")) {
      return;
    }


    const url =
      $("#resourceUrl")
        .value
        .trim();


    try {

      new URL(url);

    } catch {

      return msg(
        $("#resourceMsg"),
        "الرابط غير صالح.",
        true
      );
    }


    const title =
      $("#resourceTitle")
        .value
        .trim();


    if (!title) {

      return msg(
        $("#resourceMsg"),
        "أدخل عنوان المصدر.",
        true
      );
    }


    const subjectId =
      $("#resourceSubject")
        .value;


    if (!subjectId) {

      return msg(
        $("#resourceMsg"),
        "اختر المادة.",
        true
      );
    }


    const subject =
      data.subjects.find(
        item =>
          item.id ===
            subjectId ||
          item.stableId ===
            subjectId
      );


    if (!subject) {

      return msg(
        $("#resourceMsg"),
        "المادة غير موجودة.",
        true
      );
    }


    const selectedBranches =
      checked(
        $("#resourceBranches")
      );


    const finalBranches =
      selectedBranches.length
        ? selectedBranches
        : branchesOfSubject(
            subject
          );


    if (!finalBranches.length) {

      return msg(
        $("#resourceMsg"),
        "المادة لا تحتوي فروعًا.",
        true
      );
    }


    const categoryId =
      $("#resourceCategory")
        .value;


    if (!categoryId) {

      return msg(
        $("#resourceMsg"),
        "اختر التصنيف.",
        true
      );
    }


    const duplicate =
      data.resources.some(
        resource =>
          normalizeUrl(
            resource.url
          ) ===
          normalizeUrl(url) &&
          resource.id !==
            editing.resource
      );


    if (duplicate) {

      return msg(
        $("#resourceMsg"),
        "هذا الرابط موجود بالفعل.",
        true
      );
    }


    const payload = {

      title,

      url,

      subjectId:
        subject.id,

      branchIds:
        finalBranches,

      categoryId,

      type:
        $("#resourceType")
          .value
          .trim(),

      keywords:
        $("#resourceKeywords")
          .value
          .split(",")
          .map(
            value =>
              value.trim()
          )
          .filter(Boolean),

      order:
        Number(
          $("#resourceOrder")
            .value
        ) || 9999,

      active:
        $("#resourceActive")
          .checked,

      description:
        $("#resourceDescription")
          .value
          .trim(),

      stableId:
        slug(title)
    };


    try {

      if (editing.resource) {

        await updateDoc(
          doc(
            db,
            "resources",
            editing.resource
          ),
          {
            ...payload,
            updatedAt:
              serverTimestamp()
          }
        );

      } else {

        await addDoc(
          collection(
            db,
            "resources"
          ),
          {
            ...payload,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          }
        );
      }


      await nowLog(
        editing.resource
          ? "تعديل مصدر"
          : "إضافة مصدر",

        "resources",

        editing.resource ||
          "new",

        payload.title
      );


      msg(
        $("#resourceMsg"),
        "تم حفظ المصدر بنجاح."
      );


      $("#resourceForm")
        .classList.add(
          "hidden"
        );


      await loadAll();

    } catch (error) {

      msg(
        $("#resourceMsg"),
        errorText(error),
        true
      );
    }
  }
);


/* =========================================================
   FOUNDATION FORM
========================================================= */

$("#foundationForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!can("content_admin")) {
      return;
    }


    const url =
      $("#foundationUrl")
        .value
        .trim();


    try {

      new URL(url);

    } catch {

      return msg(
        $("#foundationMsg"),
        "الرابط غير صالح.",
        true
      );
    }


    const title =
      $("#foundationTitle")
        .value
        .trim();


    if (!title) {

      return msg(
        $("#foundationMsg"),
        "أدخل عنوان التأسيس.",
        true
      );
    }


    const subjectId =
      $("#foundationSubject")
        .value;


    if (!subjectId) {

      return msg(
        $("#foundationMsg"),
        "اختر المادة.",
        true
      );
    }


    const subject =
      data.subjects.find(
        item =>
          item.id ===
            subjectId ||
          item.stableId ===
            subjectId
      );


    if (!subject) {

      return msg(
        $("#foundationMsg"),
        "المادة غير موجودة.",
        true
      );
    }


    const selectedBranches =
      checked(
        $("#foundationBranches")
      );


    const finalBranches =
      selectedBranches.length
        ? selectedBranches
        : branchesOfSubject(
            subject
          );


    if (!finalBranches.length) {

      return msg(
        $("#foundationMsg"),
        "اختر المادة وفروعها.",
        true
      );
    }


    const payload = {

      title,

      url,

      subjectId:
        subject.id,

      branchIds:
        finalBranches,

      level:
        $("#foundationLevel")
          .value,

      type:
        $("#foundationType")
          .value,

      keywords:
        $("#foundationKeywords")
          .value
          .split(",")
          .map(
            value =>
              value.trim()
          )
          .filter(Boolean),

      order:
        Number(
          $("#foundationOrder")
            .value
        ) || 9999,

      description:
        $("#foundationDescription")
          .value
          .trim(),

      stableId:
        slug(title)
    };


    try {

      if (editing.foundation) {

        await updateDoc(
          doc(
            db,
            "foundations",
            editing.foundation
          ),
          {
            ...payload,
            updatedAt:
              serverTimestamp()
          }
        );

      } else {

        await addDoc(
          collection(
            db,
            "foundations"
          ),
          {
            ...payload,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          }
        );
      }


      await nowLog(
        editing.foundation
          ? "تعديل تأسيس"
          : "إضافة تأسيس",

        "foundations",

        editing.foundation ||
          "new",

        payload.title
      );


      msg(
        $("#foundationMsg"),
        "تم حفظ التأسيس بنجاح."
      );


      $("#foundationForm")
        .classList.add(
          "hidden"
        );


      await loadAll();

    } catch (error) {

      msg(
        $("#foundationMsg"),
        errorText(error),
        true
      );
    }
  }
);


/* =========================================================
   BULK IMPORT
========================================================= */

function resolveBranchIds(value) {

  return arr(value)
    .filter(Boolean)
    .map(
      id => {

        const branch =
          data.branches.find(
            item =>
              item.id === id ||
              item.stableId === id ||
              item.name === id
          );

        return branch?.id || null;
      }
    )
    .filter(Boolean);
}


function resolveSubject(value, name) {

  const subjectValue =
    String(
      value ||
      ""
    ).trim();

  const subjectNameValue =
    String(
      name ||
      ""
    ).trim();


  return data.subjects.find(
    subject =>
      subject.id ===
        subjectValue ||

      subject.stableId ===
        subjectValue ||

      subject.name ===
        subjectValue ||

      subject.name ===
        subjectNameValue
  );
}


function resolveCategory(value, name) {

  const categoryValue =
    String(
      value ||
      ""
    ).trim();

  const categoryNameValue =
    String(
      name ||
      ""
    ).trim();


  return data.categories.find(
    category =>
      category.id ===
        categoryValue ||

      category.stableId ===
        categoryValue ||

      category.name ===
        categoryValue ||

      category.name ===
        categoryNameValue
  );
}


async function importItems(
  selector,
  collectionName,
  messageSelector,
  type
) {

  if (!can("content_admin")) {

    return msg(
      $(messageSelector),
      "ليس لديك صلاحية.",
      true
    );
  }


  let list;


  try {

    list =
      JSON.parse(
        $(selector).value
      );

  } catch {

    return msg(
      $(messageSelector),
      "JSON غير صالح.",
      true
    );
  }


  /*
   * دعم:
   * Array مباشر
   *
   * أو:
   * { resources: [...] }
   * { foundations: [...] }
   */
  if (
    !Array.isArray(list) &&
    list &&
    typeof list === "object"
  ) {

    if (
      Array.isArray(
        list.resources
      )
    ) {

      list =
        list.resources;

    } else if (
      Array.isArray(
        list.foundations
      )
    ) {

      list =
        list.foundations;

    } else if (
      Array.isArray(
        list.items
      )
    ) {

      list =
        list.items;
    }
  }


  if (!Array.isArray(list)) {

    return msg(
      $(messageSelector),
      "يجب أن يكون JSON Array أو كائنًا يحتوي على resources/foundations/items.",
      true
    );
  }


  const existing =
    new Set(
      data[collectionName]
        .map(
          item =>
            normalizeUrl(
              item.url
            )
        )
        .filter(Boolean)
    );


  const batchUrls =
    new Set();

  const valid = [];

  let duplicates = 0;
  let invalid = 0;

  const errors = [];


  for (
    let index = 0;
    index < list.length;
    index++
  ) {

    const item =
      list[index];

    const number =
      index + 1;


    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {

      invalid++;

      errors.push(
        `العنصر ${number}: ليس Object صالحًا`
      );

      continue;
    }


    const title =
      String(
        item.title ||
        item.name ||
        ""
      ).trim();


    const url =
      String(
        item.url ||
        item.link ||
        ""
      ).trim();


    if (!title || !url) {

      invalid++;

      errors.push(
        `العنصر ${number}: العنوان أو الرابط ناقص`
      );

      continue;
    }


    try {

      new URL(url);

    } catch {

      invalid++;

      errors.push(
        `العنصر ${number}: رابط غير صالح`
      );

      continue;
    }


    const normalized =
      normalizeUrl(url);


    if (
      existing.has(normalized) ||
      batchUrls.has(normalized)
    ) {

      duplicates++;

      continue;
    }


    const subject =
      resolveSubject(
        item.subjectId,
        item.subject
      );


    if (!subject) {

      invalid++;

      errors.push(
        `العنصر ${number}: المادة غير موجودة (${item.subjectId || item.subject || "فارغ"})`
      );

      continue;
    }


    let branchIds =
      resolveBranchIds(
        item.branchIds
      );


    if (
      !branchIds.length &&
      item.branchId
    ) {

      branchIds =
        resolveBranchIds(
          item.branchId
        );
    }


    if (!branchIds.length) {

      branchIds =
        branchesOfSubject(
          subject
        );
    }


    if (!branchIds.length) {

      invalid++;

      errors.push(
        `العنصر ${number}: المادة بلا فروع`
      );

      continue;
    }


    if (
      type ===
      "resource"
    ) {

      const category =
        resolveCategory(
          item.categoryId,
          item.category
        );


      if (!category) {

        invalid++;

        errors.push(
          `العنصر ${number}: التصنيف غير موجود (${item.categoryId || item.category || "فارغ"})`
        );

        continue;
      }


      valid.push({

        title,

        url,

        subjectId:
          subject.id,

        branchIds,

        categoryId:
          category.id,

        type:
          String(
            item.type ||
            ""
          ),

        keywords:
          Array.isArray(
            item.keywords
          )
            ? item.keywords
            : String(
                item.keywords ||
                ""
              )
                .split(",")
                .map(
                  value =>
                    value.trim()
                )
                .filter(Boolean),

        author:
          String(
            item.author ||
            ""
          ),

        order:
          Number(
            item.order
          ) || 9999,

        active:
          item.active !== false,

        description:
          String(
            item.description ||
            ""
          ),

        stableId:
          slug(title),

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      });


    } else {

      valid.push({

        title,

        url,

        subjectId:
          subject.id,

        branchIds,

        level:
          item.level ||
          "beginner",

        type:
          item.type ||
          "lesson",

        keywords:
          Array.isArray(
            item.keywords
          )
            ? item.keywords
            : String(
                item.keywords ||
                ""
              )
                .split(",")
                .map(
                  value =>
                    value.trim()
                )
                .filter(Boolean),

        author:
          String(
            item.author ||
            ""
          ),

        order:
          Number(
            item.order
          ) || 9999,

        active:
          item.active !== false,

        description:
          String(
            item.description ||
            ""
          ),

        stableId:
          slug(title),

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      });
    }


    batchUrls.add(
      normalized
    );
  }


  if (!valid.length) {

    const details =
      errors
        .slice(0, 10)
        .join("\n");


    return msg(
      $(messageSelector),

      `لا توجد عناصر صالحة.\nمكرر: ${duplicates} · غير صالح: ${invalid}\n${details}`,

      true
    );
  }


  try {

    /*
     * Firestore batch limit أقل من 500.
     * نستخدم 400 كحد آمن.
     */

    for (
      let index = 0;
      index < valid.length;
      index += 400
    ) {

      const batch =
        writeBatch(db);

      const chunk =
        valid.slice(
          index,
          index + 400
        );


      chunk.forEach(
        item => {

          const reference =
            doc(
              collection(
                db,
                collectionName
              )
            );

          batch.set(
            reference,
            item
          );
        }
      );


      await batch.commit();
    }


    await nowLog(
      "استيراد جماعي",
      collectionName,
      "bulk",
      `تمت إضافة ${valid.length} من ${list.length}`
    );


    msg(
      $(messageSelector),

      `تم الاستيراد: ${valid.length}
مكرر: ${duplicates}
غير صالح: ${invalid}`,

      false
    );


    await loadAll();

  } catch (error) {

    console.error(
      "[Bulk Import]",
      error
    );

    msg(
      $(messageSelector),
      errorText(error),
      true
    );
  }
}


$("#importResources")?.addEventListener(
  "click",
  () =>
    importItems(
      "#bulkResources",
      "resources",
      "#bulkResourceMsg",
      "resource"
    )
);


$("#importFoundations")?.addEventListener(
  "click",
  () =>
    importItems(
      "#bulkFoundations",
      "foundations",
      "#bulkFoundationMsg",
      "foundation"
    )
);


/* =========================================================
   TEMPLATE EVENTS
========================================================= */

$("#templateMode")?.addEventListener(
  "change",
  () => {

    const custom =
      $("#templateMode")
        .value ===
      "custom";


    $("#customTemplateEditor")
      ?.classList.toggle(
        "hidden",
        !custom
      );


    renderTemplatePreview();
  }
);


$("#customTemplateFields")
  ?.addEventListener(
    "change",
    renderTemplatePreview
  );


[
  "customTemplateName",
  "customTemplateCollection",
  "customTemplateDescription"
].forEach(
  id => {

    $(`#${id}`)?.addEventListener(
      "input",
      renderTemplatePreview
    );
  }
);


$("#copyTemplateBtn")?.addEventListener(
  "click",
  async () => {

    renderTemplatePreview();

    const success =
      await copyTextReliable(
        $("#templatePreview")
          ?.value ||
        ""
      );


    msg(
      $("#templateMsg"),

      success
        ? "تم نسخ القالب كاملًا إلى الحافظة."
        : "تعذر النسخ التلقائي. تم تجهيز القالب، استخدم النسخ اليدوي.",

      !success
    );


    if (!success) {

      $("#templatePreview")
        ?.focus();

      $("#templatePreview")
        ?.select();
    }
  }
);


$("#resetGeneralTemplate")
  ?.addEventListener(
    "click",
    () => {

      $("#templateMode").value =
        "general";

      $("#customTemplateEditor")
        ?.classList.add(
          "hidden"
        );

      renderTemplatePreview();
    }
  );


$("#saveCustomTemplate")
  ?.addEventListener(
    "click",
    async () => {

      if (!can("content_admin")) {

        return msg(
          $("#templateMsg"),
          "ليس لديك صلاحية إدارة القوالب.",
          true
        );
      }


      const template =
        buildCustomTemplate();


      if (!template.name) {

        return msg(
          $("#templateMsg"),
          "اكتب اسم القالب.",
          true
        );
      }


      if (
        !template.fields.length
      ) {

        return msg(
          $("#templateMsg"),
          "اختر حقلًا واحدًا على الأقل.",
          true
        );
      }


      try {

        const reference =
          await addDoc(
            collection(
              db,
              "templates"
            ),
            {
              ...template,

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),

              createdBy:
                auth.currentUser?.uid ||
                ""
            }
          );


        await nowLog(
          "إضافة قالب",
          "templates",
          reference.id,
          template.name
        );


        msg(
          $("#templateMsg"),
          "تم حفظ القالب المخصص."
        );


        await loadAll();

      } catch (error) {

        msg(
          $("#templateMsg"),
          errorText(error),
          true
        );
      }
    }
  );


/* =========================================================
   ADMIN FORM
========================================================= */

$("#adminForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (role !== "superadmin") {
      return;
    }


    const uid =
      $("#adminUid")
        .value
        .trim();


    if (!uid) {

      return msg(
        $("#adminMsg"),
        "أدخل Firebase User UID.",
        true
      );
    }


    const email =
      $("#adminEmailInput")
        .value
        .trim();


    const selectedRole =
      $("#adminRole")
        .value;


    const active =
      $("#adminActive")
        .checked;


    const payload = {

      email,

      role:
        selectedRole,

      active,

      updatedAt:
        serverTimestamp()
    };


    try {

      await setDoc(
        doc(
          db,
          "admins",
          uid
        ),
        {
          ...payload,

          createdAt:
            serverTimestamp()
        },
        {
          merge: true
        }
      );


      await nowLog(
        "تعديل صلاحيات",
        "admins",
        uid,
        selectedRole
      );


      msg(
        $("#adminMsg"),
        "تم حفظ صلاحيات الأدمن."
      );


      $("#adminForm")
        .classList.add(
          "hidden"
        );


      await loadAll();

    } catch (error) {

      msg(
        $("#adminMsg"),
        errorText(error),
        true
      );
    }
  }
);


/* =========================================================
   LOGIN
========================================================= */

$("#loginBtn")?.addEventListener(
  "click",
  async () => {

    const button =
      $("#loginBtn");


    button.disabled = true;


    msg(
      $("#loginMsg"),
      "جارٍ تسجيل الدخول..."
    );


    try {

      await signInWithEmailAndPassword(
        auth,

        $("#email")
          .value
          .trim(),

        $("#password")
          .value
      );


      msg(
        $("#loginMsg"),
        "تم تسجيل الدخول، جارٍ تحميل لوحة الإدارة..."
      );


    } catch (error) {

      console.error(
        "[Login]",
        error
      );

      msg(
        $("#loginMsg"),
        errorText(error),
        true
      );

    } finally {

      button.disabled = false;
    }
  }
);


/* =========================================================
   LOGOUT
========================================================= */

$("#logoutBtn")?.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

    } catch (error) {

      console.error(
        "[Logout]",
        error
      );

      alert(
        errorText(error)
      );
    }
  }
);


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      role = null;

      $("#loginSection")
        ?.classList.remove(
          "hidden"
        );

      $("#dashboard")
        ?.classList.add(
          "hidden"
        );

      return;
    }


    try {

      /*
       * أول شيء:
       * قراءة admins/{uid}
       */
      const adminSnapshot =
        await getDoc(
          doc(
            db,
            "admins",
            user.uid
          )
        );


      if (!adminSnapshot.exists()) {

        role = null;

        $("#dashboard")
          ?.classList.add(
            "hidden"
          );

        $("#loginSection")
          ?.classList.remove(
            "hidden"
          );


        msg(
          $("#loginMsg"),
          "تم تسجيل الدخول بحساب Firebase، لكن هذا الحساب غير مفعّل كأدمن.",
          true
        );

        return;
      }


      const adminData =
        adminSnapshot.data();


      if (
        adminData.active !== true
      ) {

        role = null;

        $("#dashboard")
          ?.classList.add(
            "hidden"
          );

        $("#loginSection")
          ?.classList.remove(
            "hidden"
          );


        msg(
          $("#loginMsg"),
          "تم تسجيل الدخول، لكن حساب الأدمن موقوف.",
          true
        );

        return;
      }


      role =
        adminData.role ||
        "reviewer";


      /*
       * توحيد أسماء الأدوار القديمة.
       */
      if (
        role === "super_admin" ||
        role === "admin"
      ) {

        role =
          "superadmin";
      }


      if (
        !roleLevel[role]
      ) {

        role =
          "reviewer";
      }


      if ($("#adminEmail")) {

        $("#adminEmail")
          .textContent =
          user.email ||
          adminData.email ||
          "الأدمن";
      }


      if ($("#roleBadge")) {

        $("#roleBadge")
          .textContent =
          role;
      }


      $("#loginSection")
        ?.classList.add(
          "hidden"
        );

      $("#dashboard")
        ?.classList.remove(
          "hidden"
        );


      try {

        await loadAll();

      } catch (error) {

        console.error(
          "[Dashboard Load]",
          error
        );

        msg(
          $("#dashboardMsg"),
          `تم الدخول، لكن حدث خطأ أثناء تحميل لوحة الإدارة: ${errorText(error)}`,
          true
        );
      }


    } catch (error) {

      console.error(
        "[Admin Auth]",
        error
      );


      role = null;


      $("#dashboard")
        ?.classList.add(
          "hidden"
        );

      $("#loginSection")
        ?.classList.remove(
          "hidden"
        );


      msg(
        $("#loginMsg"),
        errorText(error),
        true
      );
    }
  }
);


/* =========================================================
   INITIAL TEMPLATE
========================================================= */

renderTemplatePreview();