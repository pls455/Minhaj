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
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  limit,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* =========================================================
   HELPERS
========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  [...document.querySelectorAll(selector)];


const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");


const arr = (value) =>
  Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];


const defaultBranches = {
  scientific: "العلمي",
  literary: "الأدبي",
  industrial: "الصناعي"
};

let branchRecords = [];
let categories = [];


let role = null;

let subjects = [];
let resources = [];
let foundations = [];
let suggestions = [];
let admins = [];

let editing = null;


/* =========================================================
   PERMISSIONS
========================================================= */

const roleLevel = {
  reviewer: 1,
  content_admin: 2,
  superadmin: 3
};


function can(requiredRole) {
  return (
    (roleLevel[role] || 0) >=
    (roleLevel[requiredRole] || 0)
  );
}


/* =========================================================
   MESSAGE
========================================================= */

function msg(element, text, error = false) {

  if (!element) return;

  element.textContent = text;

  element.className =
    error
      ? "message error"
      : "message success";
}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function errorMessage(error) {

  if (!error) {
    return "حدث خطأ غير معروف.";
  }

  return (
    error.code ||
    error.message ||
    "حدث خطأ غير معروف."
  );
}


/* =========================================================
   BRANCHES
========================================================= */

function branchName(id) {
  const item = branchRecords.find((b) => b.id === id || b.stableId === id);
  return item?.name || defaultBranches[id] || id;
}

function branchesHTML(ids = []) {
  return arr(ids).map(branchName).join("، ") || "غير محدد";
}

function categoryName(id) {
  const item = categories.find((c) => c.id === id || c.stableId === id);
  return item?.name || id || "غير محدد";
}

function resolveBranch(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const item = branchRecords.find((b) => b.id === v || b.stableId === v || b.name === v);
  return item?.id || v;
}

function resolveSubject(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const item = subjects.find((x) => x.id === v || x.stableId === v || x.name === v);
  return item?.id || v;
}

function resolveCategory(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const item = categories.find((x) => x.id === v || x.stableId === v || x.name === v);
  return item?.id || v;
}

function stableRef(item, prefix) {
  return String(item?.stableId || item?.uid || item?.id || `${prefix}_${Math.random().toString(36).slice(2, 10)}`).trim();
}

function newStableUid(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function populateTemplateGenerator() {
  const configs = [
    ["#templateBranches", branchRecords, "BR"],
    ["#templateSubjects", subjects, "SUB"],
    ["#templateCategories", categories, "CAT"]
  ];
  configs.forEach(([selector, records]) => {
    const el = $(selector);
    if (!el) return;
    const old = new Set([...el.selectedOptions].map(o => o.value));
    el.innerHTML = [...records]
      .sort((a,b)=>(a.order??9999)-(b.order??9999) || String(a.name||"").localeCompare(String(b.name||""), "ar"))
      .map(x => `<option value="${esc(x.id)}" ${old.has(x.id) ? "selected" : ""}>${esc(x.name)} — ${esc(stableRef(x,"REF"))}</option>`)
      .join("");
  });
}

function selectedValues(selector) {
  const el = $(selector);
  return el ? [...el.selectedOptions].map(o => o.value) : [];
}

function makeAlias(name, used) {
  let alias = String(name || "ref").trim().toLowerCase()
    .replace(/[^a-z0-9_\u0600-\u06ff]+/g, "_")
    .replace(/^_+|_+$/g, "") || "ref";
  if (/^\d/.test(alias)) alias = `ref_${alias}`;
  const base = alias; let i = 2;
  while (used.has(alias)) alias = `${base}_${i++}`;
  used.add(alias);
  return alias;
}

function buildTemplate({all=false} = {}) {
  const branchIds = all ? branchRecords.map(x => x.id) : selectedValues("#templateBranches");
  const subjectIds = all ? subjects.map(x => x.id) : selectedValues("#templateSubjects");
  const categoryIds = all ? categories.map(x => x.id) : selectedValues("#templateCategories");
  const refs = {};
  const aliases = { branches:{}, subjects:{}, categories:{} };
  const used = new Set();

  branchIds.forEach(id => {
    const x=branchRecords.find(v=>v.id===id);
    const a=makeAlias(x?.name,used);
    refs[a]=stableRef(x,"BR");
    aliases.branches[id]=`$${a}`;
  });
  subjectIds.forEach(id => {
    const x=subjects.find(v=>v.id===id);
    const a=makeAlias(x?.name,used);
    refs[a]=stableRef(x,"SUB");
    aliases.subjects[id]=`$${a}`;
  });
  categoryIds.forEach(id => {
    const x=categories.find(v=>v.id===id);
    const a=makeAlias(x?.name,used);
    refs[a]=stableRef(x,"CAT");
    aliases.categories[id]=`$${a}`;
  });

  const presets = {};
  if (!all) {
    const combinations = [];
    subjectIds.forEach(sid => {
      const subject = subjects.find(x=>x.id===sid);
      const validBranches = branchIds.filter(bid => arr(subject?.branchIds).includes(bid));
      validBranches.forEach(bid => categoryIds.forEach(cid => {
        const b=branchRecords.find(x=>x.id===bid), c=categories.find(x=>x.id===cid);
        const alias=makeAlias(`${b?.name || 'branch'}_${subject?.name || 'subject'}_${c?.name || 'category'}`, used);
        presets[alias] = {
          branch: aliases.branches[bid] || `$${makeAlias(b?.name, used)}`,
          subject: aliases.subjects[sid],
          category: aliases.categories[cid]
        };
        combinations.push(alias);
      }));
    });
  }

  const template = {
    version: 2,
    refs,
    presets,
    resources: [
      {
        title:"اسم المصدر",
        url:"https://example.com/file.pdf",
        preset: Object.keys(presets)[0] ? `$${Object.keys(presets)[0]}` : undefined,
        branch: Object.keys(presets).length ? undefined : undefined,
        subject: subjectIds[0] ? aliases.subjects[subjectIds[0]] : undefined,
        category: categoryIds[0] ? aliases.categories[categoryIds[0]] : undefined,
        type:"كتاب",
        description:"",
        keywords:[]
      }
    ]
  };
  const clean = JSON.parse(JSON.stringify(template));
  if (!clean.presets || !Object.keys(clean.presets).length) delete clean.presets;
  if (!all && Object.keys(clean.presets||{}).length) {
    delete clean.resources[0].subject;
    delete clean.resources[0].category;
  }
  if (all) {
    clean.resources = [];
    clean._instructions = "استخدم المفاتيح الموجودة في refs داخل الموارد بصيغة $key. لا تغيّر قيم UIDs داخل refs. يمكنك إنشاء presets إذا كانت هناك تركيبات متكررة.";
  }
  return {clean, count:Object.keys(refs).length, presetCount:Object.keys(presets).length};
}

function generateImportTemplate() {
  const {clean,count,presetCount}=buildTemplate({all:false});
  $("#generatedImportTemplate").value=JSON.stringify(clean,null,2);
  msg($("#templateMsg"), `تم توليد ${count} مرجع${presetCount ? ` و${presetCount} تركيبة جاهزة (presets)` : ""}.`, false);
}

function generateGeneralImportTemplate() {
  const {clean,count}=buildTemplate({all:true});
  $("#generatedImportTemplate").value=JSON.stringify(clean,null,2);
  msg($("#templateMsg"), `تم توليد القالب العام: ${count} UID للفروع والمواد والتصنيفات.`, false);
}

function resolvePresetItem(item, refs, presets) {
  if (!item || typeof item !== "object") return item;
  const copy = { ...item };
  if (copy.preset && String(copy.preset).startsWith("$") && presets) {
    const key=String(copy.preset).slice(1);
    const preset=presets[key];
    if (preset) {
      Object.assign(copy, preset, { preset: copy.preset });
    }
  }
  return copy;
}

function resolveRefValue(value, refs) {
  const v = String(value ?? "").trim();
  if (!v || !refs || typeof refs !== "object") return v;
  if (v.startsWith("$") && Object.prototype.hasOwnProperty.call(refs, v.slice(1))) return refs[v.slice(1)];
  return v;
}


/* =========================================================
   NORMALIZE URL
========================================================= */

function normalizeImportURL(value) {

  if (!value) {
    return "";
  }

  const raw =
    String(value).trim();

  if (!raw) {
    return "";
  }

  try {

    const url =
      new URL(raw);

    url.hash = "";

    if (
      url.pathname.length > 1 &&
      url.pathname.endsWith("/")
    ) {

      url.pathname =
        url.pathname.slice(0, -1);
    }

    return url
      .toString()
      .toLowerCase();

  } catch {

    return raw
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}


/* =========================================================
   ADMIN ROLE
========================================================= */

async function loadRole(user) {

  const adminRef =
    doc(
      db,
      "admins",
      user.uid
    );

  const snap =
    await getDoc(adminRef);

  if (
    !snap.exists() ||
    snap.data().active !== true
  ) {

    throw new Error(
      "NO_ADMIN"
    );
  }

  return (
    snap.data().role ||
    "reviewer"
  );
}


/* =========================================================
   LOAD COLLECTION
========================================================= */

async function all(collectionName) {

  const snap =
    await getDocs(
      collection(
        db,
        collectionName
      )
    );

  return snap.docs.map(
    (item) => ({
      id: item.id,
      ...item.data()
    })
  );
}


async function ensureStableIds(records, collectionName, prefix) {
  if (role !== "superadmin") return records;
  const out = [];
  for (const item of records) {
    if (item.stableId) { out.push(item); continue; }
    const stableId = newStableUid(prefix);
    try {
      await updateDoc(doc(db, collectionName, item.id), { stableId, updatedAt: serverTimestamp() });
      out.push({ ...item, stableId });
    } catch (error) {
      console.warn(`Could not assign stableId to ${collectionName}/${item.id}`, error);
      out.push(item);
    }
  }
  return out;
}

/* =========================================================
   REFRESH DATA
========================================================= */

async function refresh() {

  try {

    const [
      branchesResult,
      subjectsResult,
      categoriesResult,
      resourcesResult,
      foundationsResult,
      suggestionsResult
    ] =
      await Promise.all([

        all("branches"),

        all("subjects"),

        all("categories"),

        all("resources"),

        all("foundations"),

        getDocs(
          query(
            collection(
              db,
              "suggestions"
            ),
            where(
              "status",
              "==",
              "pending"
            ),
            limit(300)
          )
        )

      ]);


    branchRecords = branchesResult;
    subjects = subjectsResult;
    categories = categoriesResult;

    if (role === "superadmin") {
      branchRecords = await ensureStableIds(branchRecords, "branches", "BR");
      subjects = await ensureStableIds(subjects, "subjects", "SUB");
      categories = await ensureStableIds(categories, "categories", "CAT");
    }

    resources =
      resourcesResult;

    foundations =
      foundationsResult;


    suggestions =
      suggestionsResult.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );


    if (
      role === "superadmin"
    ) {

      admins =
        await all("admins");

    } else {

      admins = [];

    }


    updateCounters();

    renderAll();

  } catch (error) {

    console.error(
      "Refresh error:",
      error
    );

    alert(
      "فشل تحميل بيانات لوحة الإدارة.\n\n" +
      errorMessage(error)
    );
  }
}


/* =========================================================
   COUNTERS
========================================================= */

function updateCounters() {

  if ($("#subjectsCount")) {

    $("#subjectsCount")
      .textContent =
      subjects.length;

  }

  if ($("#resourcesCount")) {

    $("#resourcesCount")
      .textContent =
      resources.length;

  }

  if ($("#foundationsCount")) {

    $("#foundationsCount")
      .textContent =
      foundations.length;

  }

  if ($("#suggestionsCount")) {

    $("#suggestionsCount")
      .textContent =
      suggestions.length;

  }
}


/* =========================================================
   SUBJECT OPTIONS
========================================================= */

function subjectOptions(
  branch = ""
) {
  branch = resolveBranch(branch);

  return subjects

    .filter((subject) => {

      if (!branch) {
        return true;
      }

      return arr(
        subject.branchIds
      ).includes(branch);

    })

    .sort(
      (a, b) =>
        (a.order ?? 9999) -
        (b.order ?? 9999)
    )

    .map(
      (subject) => `
        <option value="${esc(subject.id)}">
          ${esc(subject.name)}
        </option>
      `
    )

    .join("");
}


function branchOptions(selected = "") {
  const items = [...branchRecords].sort((a,b)=>(a.order??9999)-(b.order??9999));
  return items.map((b) => `<option value="${esc(b.id)}" ${b.id === selected ? "selected" : ""}>${esc(b.name)}</option>`).join("");
}

function categoryOptions(selected = "") {
  const items = [...categories].sort((a,b)=>(a.order??9999)-(b.order??9999));
  return items.map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`).join("");
}

function refreshDynamicSelects() {
  if ($("#resourceBranch")) {
    const current = $("#resourceBranch").value;
    $("#resourceBranch").innerHTML = '<option value="">اختر الفرع</option>' + branchOptions(current);
  }
  if ($("#foundationBranch")) {
    const current = $("#foundationBranch").value;
    $("#foundationBranch").innerHTML = '<option value="">اختر الفرع</option>' + branchOptions(current);
  }
  if ($("#resourceCategory")) {
    const current = $("#resourceCategory").value;
    $("#resourceCategory").innerHTML = '<option value="">اختر التصنيف</option>' + categoryOptions(current);
  }
}

/* =========================================================
   DOCUMENT ID
========================================================= */

function documentIdHTML(id) {

  if (!id) {
    return "";
  }

  return `
    <p class="admin-doc-id">

      <strong>
        Document ID:
      </strong>

      <code>
        ${esc(id)}
      </code>

      <button
        type="button"
        class="btn small"
        data-copy-id="${esc(id)}">

        📋 نسخ ID

      </button>

    </p>
  `;
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  if ($("#branchesList")) {
    $("#branchesList").innerHTML = [...branchRecords].sort((a,b)=>(a.order??9999)-(b.order??9999)).map((b) => `
      <div class="admin-item">
        <div>
          <strong>🌿 ${esc(b.name)}</strong>
          <p>UID: <code>${esc(b.id)}</code> · ترتيب ${b.order ?? "-"}</p>
          ${b.description ? `<p>${esc(b.description)}</p>` : ""}
        </div>
        <div>
          <button class="btn small" data-edit-branch="${esc(b.id)}">تعديل</button>
          <button class="btn danger small" data-del-branch="${esc(b.id)}">حذف</button>
        </div>
      </div>`).join("") || '<div class="empty">لا توجد فروع.</div>';
  }

  if ($("#categoriesList")) {
    $("#categoriesList").innerHTML = [...categories].sort((a,b)=>(a.order??9999)-(b.order??9999)).map((c) => `
      <div class="admin-item"><div><strong>🗂️ ${esc(c.name)}</strong><p>UID: <code>${esc(c.id)}</code></p></div></div>`).join("") || '<div class="empty">لا توجد تصنيفات.</div>';
  }

  refreshDynamicSelects();
  populateTemplateGenerator();

  /* =======================================================
     SUBJECTS
  ======================================================= */

  if ($("#subjectsList")) {

    $("#subjectsList").innerHTML =

      [...subjects]

        .sort(
          (a, b) =>
            (a.order ?? 9999) -
            (b.order ?? 9999)
        )

        .map(
          (subject) => `

            <div class="admin-item">

              <div>

                <strong>
                  ${esc(subject.name)}
                </strong>

                <p>
                  ${branchesHTML(
                    subject.branchIds
                  )}

                  · ترتيب
                  ${subject.order ?? "-"}

                </p>

                ${documentIdHTML(
                  subject.id
                )}

              </div>


              <div>

                <button
                  class="btn small"
                  data-edit-sub="${esc(subject.id)}">

                  تعديل

                </button>


                <button
                  class="btn danger small"
                  data-del-sub="${esc(subject.id)}">

                  حذف

                </button>

              </div>

            </div>

          `
        )

        .join("") ||

      '<div class="empty">لا توجد مواد.</div>';
  }


  /* =======================================================
     RESOURCES
  ======================================================= */

  if ($("#resourcesList")) {

    $("#resourcesList").innerHTML =

      [...resources]

        .sort(
          (a, b) =>
            (a.order ?? 9999) -
            (b.order ?? 9999)
        )

        .map(
          (resource) => `

            <div class="admin-item">

              <div>

                <strong>
                  ${esc(resource.title)}
                </strong>

                <p>

                  ${
                    branchName(resource.branchId) ||
                    branchesHTML(
                      resource.branchIds
                    )
                  }

                  ·

                  ${esc(
                    resource.type ||
                    "مصدر"
                  )}

                  ·

                  <a
                    href="${esc(resource.url)}"
                    target="_blank"
                    rel="noopener noreferrer">

                    الرابط

                  </a>

                </p>

                ${documentIdHTML(
                  resource.id
                )}

              </div>


              <div>

                <button
                  class="btn small"
                  data-edit-res="${esc(resource.id)}">

                  تعديل

                </button>


                <button
                  class="btn danger small"
                  data-del-res="${esc(resource.id)}">

                  حذف

                </button>

              </div>

            </div>

          `
        )

        .join("") ||

      '<div class="empty">لا توجد مصادر.</div>';
  }


  /* =======================================================
     FOUNDATIONS
  ======================================================= */

  if ($("#foundationsList")) {

    $("#foundationsList").innerHTML =

      [...foundations]

        .sort(
          (a, b) =>
            (a.order ?? 9999) -
            (b.order ?? 9999)
        )

        .map(
          (foundation) => `

            <div class="admin-item">

              <div>

                <strong>
                  🧠 ${esc(
                    foundation.title
                  )}
                </strong>

                <p>

                  ${branchesHTML(
                    foundation.branchIds ||
                    foundation.branchId
                  )}

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

                  <a
                    href="${esc(
                      foundation.url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer">

                    الرابط

                  </a>

                </p>

                ${documentIdHTML(
                  foundation.id
                )}

              </div>


              <div>

                <button
                  class="btn small"
                  data-edit-found="${esc(
                    foundation.id
                  )}">

                  تعديل

                </button>


                <button
                  class="btn danger small"
                  data-del-found="${esc(
                    foundation.id
                  )}">

                  حذف

                </button>

              </div>

            </div>

          `
        )

        .join("") ||

      '<div class="empty">لا يوجد تأسيس.</div>';
  }


  /* =======================================================
     SUGGESTIONS
  ======================================================= */

  if ($("#suggestionsList")) {

    $("#suggestionsList").innerHTML =

      suggestions

        .map(
          (suggestion) => `

            <div class="admin-item suggestion">

              <div>

                <strong>
                  ${esc(
                    suggestion.title
                  )}
                </strong>

                <p>

                  ${
                    suggestion.contentType ===
                    "foundation"
                      ? "🧠 تأسيس"
                      : "📚 مصدر"
                  }

                  ·

                  ${branchesHTML(
                    suggestion.branchIds ||
                    suggestion.branchId
                  )}

                  · الطالب:

                  ${esc(
                    suggestion.studentName ||
                    "غير محدد"
                  )}

                </p>


                ${
                  suggestion.description
                    ? `
                      <p>
                        ${esc(
                          suggestion.description
                        )}
                      </p>
                    `
                    : ""
                }


                ${
                  suggestion.url
                    ? `
                      <a
                        href="${esc(
                          suggestion.url
                        )}"
                        target="_blank"
                        rel="noopener noreferrer">

                        فتح الرابط

                      </a>
                    `
                    : ""
                }

              </div>


              <div>

                <button
                  class="btn primary small"
                  data-approve="${esc(
                    suggestion.id
                  )}">

                  ✅ موافقة

                </button>


                <button
                  class="btn danger small"
                  data-reject="${esc(
                    suggestion.id
                  )}">

                  ❌ رفض

                </button>

              </div>

            </div>

          `
        )

        .join("") ||

      '<div class="empty">لا توجد اقتراحات معلقة.</div>';
  }


  /* =======================================================
     RECENT SUGGESTIONS
  ======================================================= */

  if ($("#recentSuggestions")) {

    $("#recentSuggestions").innerHTML =

      suggestions
        .slice(0, 5)

        .map(
          (suggestion) => `

            <div class="admin-item">

              <div>

                <strong>
                  ${esc(
                    suggestion.title
                  )}
                </strong>

                <p>
                  قيد المراجعة ·
                  ${esc(
                    suggestion.studentName ||
                    "طالب"
                  )}
                </p>

              </div>


              <button
                class="btn small"
                data-tabjump="suggestions">

                مراجعة

              </button>

            </div>

          `
        )

        .join("") ||

      '<div class="empty">لا توجد اقتراحات معلقة.</div>';
  }


  /* =======================================================
     SUPER ADMIN
  ======================================================= */

  $$(".super-only")
    .forEach((element) => {

      element.classList.toggle(
        "hidden",
        role !== "superadmin"
      );

    });


  if ($("#adminsList")) {

    if (
      role !== "superadmin"
    ) {

      $("#adminsList")
        .innerHTML = "";

    } else {

      $("#adminsList").innerHTML =

        admins
          .map(
            (admin) => `

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
                      admin.active
                        ? "نشط"
                        : "موقوف"
                    }

                    · UID:

                    ${esc(admin.id)}

                  </p>

                </div>


                ${
                  admin.active
                    ? `
                      <button
                        class="btn danger small"
                        data-del-admin="${esc(
                          admin.id
                        )}">

                        تعطيل

                      </button>
                    `
                    : `
                      <button
                        class="btn small"
                        data-enable-admin="${esc(
                          admin.id
                        )}">

                        تفعيل

                      </button>
                    `
                }

              </div>

            `
          )

          .join("") ||

        '<div class="empty">لا يوجد أدمن.</div>';
    }
  }
}


/* =========================================================
   TABS
========================================================= */

function openTab(name) {

  $$(".admin-tab")
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.tab === name
      );

    });


  $$(".admin-panel")
    .forEach((panel) => {

      panel.classList.add(
        "hidden"
      );

    });


  $("#" + name + "Panel")
    ?.classList.remove(
      "hidden"
    );
}


$$(".admin-tab")
  .forEach((button) => {

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

  });


/* =========================================================
   COPY DOCUMENT ID
========================================================= */

document.addEventListener(
  "click",
  async (event) => {

    const target =
      event.target;


    if (
      target.dataset.copyId
    ) {

      try {

        await navigator.clipboard.writeText(
          target.dataset.copyId
        );

        const oldText =
          target.textContent;

        target.textContent =
          "✅ تم النسخ";

        setTimeout(() => {

          target.textContent =
            oldText;

        }, 1500);

      } catch {

        alert(
          "تعذر نسخ Document ID."
        );

      }

      return;
    }


    /* =====================================================
       TAB JUMP
    ===================================================== */

    if (
      target.dataset.tabjump
    ) {

      openTab(
        target.dataset.tabjump
      );

      return;
    }


    /* =====================================================
       DELETE BRANCH
    ===================================================== */
    if (target.dataset.delBranch) {
      if (!can("superadmin")) return alert("ليس لديك صلاحية.");
      const id = target.dataset.delBranch;
      const usedSubjects = subjects.filter(s => arr(s.branchIds).map(resolveBranch).includes(id)).length;
      const usedResources = resources.filter(r => arr(r.branchIds || r.branchId).map(resolveBranch).includes(id)).length;
      if (usedSubjects || usedResources) {
        return alert(`لا يمكن حذف الفرع الآن.\n\nمرتبط بـ ${usedSubjects} مادة و ${usedResources} مصدر.\nأزل الارتباطات أولًا.`);
      }
      if (!confirm("هل تريد حذف الفرع؟\nهذا الإجراء لا يمكن التراجع عنه.")) return;
      try { await deleteDoc(doc(db, "branches", id)); await refresh(); } catch (error) { alert("فشل حذف الفرع:\n" + errorMessage(error)); }
      return;
    }

    /* =====================================================
       EDIT BRANCH
    ===================================================== */
    if (target.dataset.editBranch) {
      const b = branchRecords.find(x => x.id === target.dataset.editBranch);
      if (!b || !can("superadmin")) return;
      editing = b.id;
      $("#branchName").value = b.name || "";
      $("#branchDescription").value = b.description || "";
      $("#branchOrder").value = b.order ?? "";
      $("#branchForm").classList.remove("hidden");
      openTab("branches");
      return;
    }

    /* =====================================================
       DELETE SUBJECT
    ===================================================== */

    if (
      target.dataset.delSub
    ) {

      if (
        !can("content_admin")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      if (
        !confirm(
          "هل تريد حذف المادة؟"
        )
      ) {

        return;
      }


      try {

        await deleteDoc(
          doc(
            db,
            "subjects",
            target.dataset.delSub
          )
        );

        await refresh();

      } catch (error) {

        alert(
          "فشل حذف المادة:\n" +
          errorMessage(error)
        );

      }

      return;
    }


    /* =====================================================
       DELETE RESOURCE
    ===================================================== */

    if (
      target.dataset.delRes
    ) {

      if (
        !can("content_admin")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      if (
        !confirm(
          "هل تريد حذف المصدر؟"
        )
      ) {

        return;
      }


      try {

        await deleteDoc(
          doc(
            db,
            "resources",
            target.dataset.delRes
          )
        );

        await refresh();

      } catch (error) {

        alert(
          "فشل حذف المصدر:\n" +
          errorMessage(error)
        );

      }

      return;
    }


    /* =====================================================
       DELETE FOUNDATION
    ===================================================== */

    if (
      target.dataset.delFound
    ) {

      if (
        !can("content_admin")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      if (
        !confirm(
          "هل تريد حذف التأسيس؟"
        )
      ) {

        return;
      }


      try {

        await deleteDoc(
          doc(
            db,
            "foundations",
            target.dataset.delFound
          )
        );

        await refresh();

      } catch (error) {

        alert(
          "فشل حذف التأسيس:\n" +
          errorMessage(error)
        );

      }

      return;
    }


    /* =====================================================
       APPROVE SUGGESTION
    ===================================================== */

    if (
      target.dataset.approve
    ) {

      if (
        !can("reviewer")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      await review(
        target.dataset.approve,
        true
      );

      return;
    }


    /* =====================================================
       REJECT SUGGESTION
    ===================================================== */

    if (
      target.dataset.reject
    ) {

      if (
        !can("reviewer")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      await review(
        target.dataset.reject,
        false
      );

      return;
    }


    /* =====================================================
       EDIT SUBJECT
    ===================================================== */

    if (
      target.dataset.editSub
    ) {

      editSubject(
        target.dataset.editSub
      );

      return;
    }


    /* =====================================================
       EDIT RESOURCE
    ===================================================== */

    if (
      target.dataset.editRes
    ) {

      editResource(
        target.dataset.editRes
      );

      return;
    }


    /* =====================================================
       EDIT FOUNDATION
    ===================================================== */

    if (
      target.dataset.editFound
    ) {

      editFoundation(
        target.dataset.editFound
      );

      return;
    }


    /* =====================================================
       DISABLE ADMIN
    ===================================================== */

    if (
      target.dataset.delAdmin
    ) {

      if (
        role !== "superadmin"
      ) {

        alert(
          "هذه العملية لـ Super Admin فقط."
        );

        return;
      }


      if (
        !confirm(
          "هل تريد تعطيل هذا الأدمن؟"
        )
      ) {

        return;
      }


      try {

        await updateDoc(
          doc(
            db,
            "admins",
            target.dataset.delAdmin
          ),
          {
            active: false,
            updatedAt:
              serverTimestamp()
          }
        );

        await refresh();

      } catch (error) {

        alert(
          "فشل تعطيل الأدمن:\n" +
          errorMessage(error)
        );

      }

      return;
    }


    /* =====================================================
       ENABLE ADMIN
    ===================================================== */

    if (
      target.dataset.enableAdmin
    ) {

      if (
        role !== "superadmin"
      ) {

        alert(
          "هذه العملية لـ Super Admin فقط."
        );

        return;
      }


      try {

        await updateDoc(
          doc(
            db,
            "admins",
            target.dataset.enableAdmin
          ),
          {
            active: true,
            updatedAt:
              serverTimestamp()
          }
        );

        await refresh();

      } catch (error) {

        alert(
          "فشل تفعيل الأدمن:\n" +
          errorMessage(error)
        );

      }

      return;
    }


    /* =====================================================
       ADD SUBJECT
    ===================================================== */

    if (
      target.id ===
      "addSubjectBtn"
    ) {

      if (
        !can("content_admin")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      editing = null;

      $("#subjectForm")
        ?.classList.remove(
          "hidden"
        );

      return;
    }


    /* =====================================================
       CANCEL SUBJECT
    ===================================================== */

    if (
      target.id ===
      "cancelSubject"
    ) {

      $("#subjectForm")
        ?.classList.add(
          "hidden"
        );

      editing = null;

      return;
    }


    /* =====================================================
       ADD RESOURCE
    ===================================================== */

    if (
      target.id ===
      "addResourceBtn"
    ) {

      if (
        !can("content_admin")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      editing = null;

      $("#resourceForm")
        ?.classList.remove(
          "hidden"
        );

      return;
    }


    /* =====================================================
       CANCEL RESOURCE
    ===================================================== */

    if (
      target.id ===
      "cancelResource"
    ) {

      $("#resourceForm")
        ?.classList.add(
          "hidden"
        );

      editing = null;

      return;
    }


    /* =====================================================
       ADD FOUNDATION
    ===================================================== */

    if (
      target.id ===
      "addFoundationBtn"
    ) {

      if (
        !can("content_admin")
      ) {

        alert(
          "ليس لديك صلاحية."
        );

        return;
      }


      editing = null;

      $("#foundationForm")
        ?.classList.remove(
          "hidden"
        );

      return;
    }


    /* =====================================================
       CANCEL FOUNDATION
    ===================================================== */

    if (
      target.id ===
      "cancelFoundation"
    ) {

      $("#foundationForm")
        ?.classList.add(
          "hidden"
        );

      editing = null;

      return;
    }

  }
);


/* =========================================================
   REVIEW SUGGESTION
========================================================= */

async function review(
  id,
  approve
) {

  const suggestion =
    suggestions.find(
      (item) =>
        item.id === id
    );


  if (!suggestion) {

    alert(
      "الاقتراح غير موجود."
    );

    return;
  }


  try {

    if (approve) {

      const data = {
        ...suggestion
      };


      delete data.id;
      delete data.status;
      delete data.reviewedAt;
      delete data.reviewedBy;


      data.createdAt =
        serverTimestamp();

      data.updatedAt =
        serverTimestamp();


      if (
        suggestion.contentType ===
        "foundation"
      ) {

        await addDoc(
          collection(
            db,
            "foundations"
          ),
          data
        );

      } else {

        await addDoc(
          collection(
            db,
            "resources"
          ),
          data
        );

      }

    }


    await updateDoc(
      doc(
        db,
        "suggestions",
        id
      ),
      {
        status:
          approve
            ? "approved"
            : "rejected",

        reviewedAt:
          serverTimestamp(),

        reviewedBy:
          auth.currentUser?.uid || ""
      }
    );


    await refresh();

  } catch (error) {

    console.error(
      "Suggestion review error:",
      error
    );

    alert(
      "فشلت عملية مراجعة الاقتراح:\n\n" +
      errorMessage(error)
    );

  }
}


/* =========================================================
   EDIT SUBJECT
========================================================= */

function editSubject(id) {

  if (
    !can("content_admin")
  ) {

    alert(
      "ليس لديك صلاحية."
    );

    return;
  }


  const subject =
    subjects.find(
      (item) =>
        item.id === id
    );


  if (!subject) {
    return;
  }


  editing = id;


  $("#subjectName")
    .value =
    subject.name || "";


  $("#subjectOrder")
    .value =
    subject.order ?? "";


  $("#subjectDescription")
    .value =
    subject.description || "";


  $$("#subjectForm input[type=checkbox]")
    .forEach((checkbox) => {

      checkbox.checked =
        arr(
          subject.branchIds
        ).includes(
          checkbox.value
        );

    });


  $("#subjectForm")
    ?.classList.remove(
      "hidden"
    );


  openTab("subjects");
}


/* =========================================================
   EDIT RESOURCE
========================================================= */

function editResource(id) {

  if (
    !can("content_admin")
  ) {

    alert(
      "ليس لديك صلاحية."
    );

    return;
  }


  const resource =
    resources.find(
      (item) =>
        item.id === id
    );


  if (!resource) {
    return;
  }


  editing = id;


  $("#resourceTitle")
    .value =
    resource.title || "";


  $("#resourceUrl")
    .value =
    resource.url || "";


  $("#resourceBranch")
    .value =
    resource.branchId ||
    arr(
      resource.branchIds
    )[0] ||
    "";


  $("#resourceSubject")
    .innerHTML =
      '<option value="">اختر المادة</option>' +
      subjectOptions(
        $("#resourceBranch")
          .value
      );


  $("#resourceSubject")
    .value =
    resource.subjectId || "";


  $("#resourceType")
    .value =
    resource.type || "";


  $("#resourceCategory")
    .value =
    resource.categoryId ||
    resolveCategory(resource.category) ||
    "";


  $("#resourceKeywords")
    .value =
    arr(
      resource.keywords
    ).join(", ");


  $("#resourceOrder")
    .value =
    resource.order ?? "";


  $("#resourceDescription")
    .value =
    resource.description || "";


  $("#resourceForm")
    ?.classList.remove(
      "hidden"
    );


  openTab("resources");
}


/* =========================================================
   EDIT FOUNDATION
========================================================= */

function editFoundation(id) {

  if (
    !can("content_admin")
  ) {

    alert(
      "ليس لديك صلاحية."
    );

    return;
  }


  const foundation =
    foundations.find(
      (item) =>
        item.id === id
    );


  if (!foundation) {
    return;
  }


  editing = id;


  $("#foundationTitle")
    .value =
    foundation.title || "";


  $("#foundationUrl")
    .value =
    foundation.url || "";


  $("#foundationBranch")
    .value =
    foundation.branchId ||
    arr(
      foundation.branchIds
    )[0] ||
    "";


  $("#foundationSubject")
    .innerHTML =
      '<option value="">اختر المادة</option>' +
      subjectOptions(
        $("#foundationBranch")
          .value
      );


  $("#foundationSubject")
    .value =
    foundation.subjectId || "";


  $("#foundationLevel")
    .value =
    foundation.level ||
    "beginner";


  $("#foundationType")
    .value =
    foundation.type ||
    "lesson";


  $("#foundationKeywords")
    .value =
    arr(
      foundation.keywords
    ).join(", ");


  $("#foundationOrder")
    .value =
    foundation.order ?? "";


  $("#foundationDescription")
    .value =
    foundation.description || "";


  $("#foundationForm")
    ?.classList.remove(
      "hidden"
    );


  openTab("foundations");
}


/* =========================================================
   JSON PARSER
========================================================= */

function parseJSON(
  selector,
  messageSelector
) {

  const element =
    $(selector);

  if (!element) {

    msg(
      $(messageSelector),
      "حقل JSON غير موجود في الصفحة.",
      true
    );

    return null;
  }


  const text =
    element.value.trim();


  if (!text) {

    msg(
      $(messageSelector),
      "أدخل بيانات JSON أولًا.",
      true
    );

    return null;
  }


  try {

    return JSON.parse(text);

  } catch (error) {

    console.error(
      "JSON parse error:",
      error
    );

    msg(
      $(messageSelector),
      "JSON غير صالح. تأكد من الأقواس والفواصل.",
      true
    );

    return null;
  }
}


/* =========================================================
   LOGIN
========================================================= */

if ($("#loginBtn")) {

  $("#loginBtn").onclick =
    async () => {

      const email =
        $("#email")
          ?.value
          .trim();

      const password =
        $("#password")
          ?.value || "";


      if (!email || !password) {

        msg(
          $("#loginMsg"),
          "أدخل البريد الإلكتروني وكلمة المرور.",
          true
        );

        return;
      }


      try {

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      } catch (error) {

        console.error(
          "Login error:",
          error
        );

        msg(
          $("#loginMsg"),
          "فشل تسجيل الدخول. تأكد من البيانات وصلاحية الحساب.",
          true
        );

      }

    };
}


if ($("#password")) {

  $("#password").onkeydown =
    (event) => {

      if (
        event.key ===
        "Enter"
      ) {

        $("#loginBtn")
          ?.click();

      }

    };
}


if ($("#logoutBtn")) {

  $("#logoutBtn").onclick =
    async () => {

      try {

        await signOut(auth);

      } catch (error) {

        console.error(
          "Logout error:",
          error
        );

      }

    };
}


if ($("#addBranchBtn")) $("#addBranchBtn").onclick = () => { editing = null; $("#branchForm").reset(); $("#branchForm").classList.remove("hidden"); };
if ($("#cancelBranch")) $("#cancelBranch").onclick = () => { $("#branchForm").classList.add("hidden"); editing = null; };
if ($("#addCategoryBtn")) $("#addCategoryBtn").onclick = () => { $("#categoryForm").reset(); $("#categoryForm").classList.remove("hidden"); };
if ($("#cancelCategory")) $("#cancelCategory").onclick = () => $("#categoryForm").classList.add("hidden");

/* =========================================================
   BRANCH -> SUBJECT
========================================================= */

if ($("#resourceBranch")) {

  $("#resourceBranch")
    .onchange =
    () => {

      const branch =
        $("#resourceBranch")
          .value;

      $("#resourceSubject")
        .innerHTML =
          '<option value="">اختر المادة</option>' +
          subjectOptions(branch);

    };
}


if ($("#foundationBranch")) {

  $("#foundationBranch")
    .onchange =
    () => {

      const branch =
        $("#foundationBranch")
          .value;

      $("#foundationSubject")
        .innerHTML =
          '<option value="">اختر المادة</option>' +
          subjectOptions(branch);

    };
}


/* =========================================================
   SUBJECT FORM
========================================================= */

if ($("#subjectForm")) {

  $("#subjectForm")
    .onsubmit =
    async (event) => {

      event.preventDefault();


      if (
        !can("content_admin")
      ) {

        return msg(
          $("#subjectMsg"),
          "ليس لديك صلاحية.",
          true
        );

      }


      const data = {

        name:
          $("#subjectName")
            .value
            .trim(),

        branchIds:
          $$("#subjectForm input[type=checkbox]:checked")
            .map(
              (checkbox) =>
                checkbox.value
            ),

        description:
          $("#subjectDescription")
            .value
            .trim(),

        order:
          Number(
            $("#subjectOrder")
              .value
          ) || 9999,

        updatedAt:
          serverTimestamp()

      };


      if (!data.name) {

        return msg(
          $("#subjectMsg"),
          "أدخل اسم المادة.",
          true
        );

      }


      if (
        !data.branchIds.length
      ) {

        return msg(
          $("#subjectMsg"),
          "اختر فرعًا واحدًا على الأقل.",
          true
        );

      }


      try {

        if (editing) {

          await updateDoc(
            doc(
              db,
              "subjects",
              editing
            ),
            data
          );

        } else {

          await addDoc(
            collection(
              db,
              "subjects"
            ),
            {
              ...data,
              stableId: newStableUid("SUB"),
              createdAt:
                serverTimestamp()
            }
          );

        }


        editing = null;


        $("#subjectForm")
          .classList.add(
            "hidden"
          );


        await refresh();

      } catch (error) {

        console.error(
          "Subject save error:",
          error
        );

        msg(
          $("#subjectMsg"),
          "فشل حفظ المادة:\n" +
          errorMessage(error),
          true
        );

      }

    };
}


/* =========================================================
   BRANCH FORM
========================================================= */
if ($("#branchForm")) {
  $("#branchForm").onsubmit = async (event) => {
    event.preventDefault();
    if (!can("superadmin")) return msg($("#branchMsg"), "ليس لديك صلاحية.", true);
    const name = $("#branchName").value.trim();
    if (!name) return msg($("#branchMsg"), "أدخل اسم الفرع.", true);
    const data = { name, description: $("#branchDescription").value.trim(), order: Number($("#branchOrder").value) || 9999, updatedAt: serverTimestamp() };
    if (!editing) data.stableId = newStableUid("BR");
    try {
      if (editing) {
        await updateDoc(doc(db, "branches", editing), data);
      } else {
        const ref = await addDoc(collection(db, "branches"), { ...data, createdAt: serverTimestamp() });
        $("#branchMsg").textContent = `تم إنشاء الفرع. UID: ${data.stableId}`;
      }
      editing = null;
      $("#branchForm").classList.add("hidden");
      await refresh();
    } catch (error) { msg($("#branchMsg"), "فشل حفظ الفرع:\n" + errorMessage(error), true); }
  };
}

/* =========================================================
   CATEGORY FORM
========================================================= */
if ($("#categoryForm")) {
  $("#categoryForm").onsubmit = async (event) => {
    event.preventDefault();
    if (!can("superadmin")) return msg($("#categoryMsg"), "ليس لديك صلاحية.", true);
    const name = $("#categoryName").value.trim();
    if (!name) return msg($("#categoryMsg"), "أدخل اسم التصنيف.", true);
    try {
      await addDoc(collection(db, "categories"), { name, stableId: newStableUid("CAT"), order: Number($("#categoryOrder").value) || 9999, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      $("#categoryForm").classList.add("hidden");
      await refresh();
    } catch (error) { msg($("#categoryMsg"), "فشل حفظ التصنيف:\n" + errorMessage(error), true); }
  };
}

/* =========================================================
   RESOURCE FORM
========================================================= */

if ($("#resourceForm")) {

  $("#resourceForm")
    .onsubmit =
    async (event) => {

      event.preventDefault();


      if (
        !can("content_admin")
      ) {

        return msg(
          $("#resourceMsg"),
          "ليس لديك صلاحية.",
          true
        );

      }


      const url =
        $("#resourceUrl")
          .value
          .trim();


      if (!url) {

        return msg(
          $("#resourceMsg"),
          "أدخل الرابط.",
          true
        );

      }


      try {

        new URL(url);

      } catch {

        return msg(
          $("#resourceMsg"),
          "الرابط غير صالح.",
          true
        );

      }


      const normalized =
        normalizeImportURL(url);


      const duplicate =
        resources.some(
          (resource) =>

            normalizeImportURL(
              resource.url
            ) === normalized &&

            resource.id !== editing
        );


      if (duplicate) {

        return msg(
          $("#resourceMsg"),
          "هذا الرابط موجود بالفعل.",
          true
        );

      }


      const branchId =
        resolveBranch($("#resourceBranch").value);


      const subjectId =
        resolveSubject($("#resourceSubject").value);


      if (!branchId) {

        return msg(
          $("#resourceMsg"),
          "اختر الفرع.",
          true
        );

      }


      if (!subjectId) {

        return msg(
          $("#resourceMsg"),
          "اختر المادة.",
          true
        );

      }


      const data = {

        title:
          $("#resourceTitle")
            .value
            .trim(),

        url,

        branchId,

        branchIds: [
          branchId
        ],

        subjectId,

        type:
          $("#resourceType")
            .value
            .trim(),

        category:
          $("#resourceCategory")
            .value
            .trim(),

        keywords:
          $("#resourceKeywords")
            .value
            .split(",")
            .map(
              (item) =>
                item.trim()
            )
            .filter(Boolean),

        order:
          Number(
            $("#resourceOrder")
              .value
          ) || 9999,

        description:
          $("#resourceDescription")
            .value
            .trim(),

        updatedAt:
          serverTimestamp()

      };


      if (!data.title) {

        return msg(
          $("#resourceMsg"),
          "أدخل عنوان المصدر.",
          true
        );

      }


      try {

        if (editing) {

          await updateDoc(
            doc(
              db,
              "resources",
              editing
            ),
            data
          );

        } else {

          await addDoc(
            collection(
              db,
              "resources"
            ),
            {
              ...data,
              createdAt:
                serverTimestamp()
            }
          );

        }


        editing = null;


        $("#resourceForm")
          .classList.add(
            "hidden"
          );


        await refresh();

      } catch (error) {

        console.error(
          "Resource save error:",
          error
        );

        msg(
          $("#resourceMsg"),
          "فشل حفظ المصدر:\n" +
          errorMessage(error),
          true
        );

      }

    };
}


/* =========================================================
   FOUNDATION FORM
========================================================= */

if ($("#foundationForm")) {

  $("#foundationForm")
    .onsubmit =
    async (event) => {

      event.preventDefault();


      if (
        !can("content_admin")
      ) {

        return msg(
          $("#foundationMsg"),
          "ليس لديك صلاحية.",
          true
        );

      }


      const url =
        $("#foundationUrl")
          .value
          .trim();


      if (!url) {

        return msg(
          $("#foundationMsg"),
          "أدخل الرابط.",
          true
        );

      }


      try {

        new URL(url);

      } catch {

        return msg(
          $("#foundationMsg"),
          "الرابط غير صالح.",
          true
        );

      }


      const normalized =
        normalizeImportURL(url);


      const duplicate =
        foundations.some(
          (foundation) =>

            normalizeImportURL(
              foundation.url
            ) === normalized &&

            foundation.id !== editing
        );


      if (duplicate) {

        return msg(
          $("#foundationMsg"),
          "هذا الرابط موجود بالفعل.",
          true
        );

      }


      const branch =
        $("#foundationBranch")
          .value;


      const subject =
        $("#foundationSubject")
          .value;


      if (!branch) {

        return msg(
          $("#foundationMsg"),
          "اختر الفرع.",
          true
        );

      }


      if (!subject) {

        return msg(
          $("#foundationMsg"),
          "اختر المادة.",
          true
        );

      }


      const data = {

        title:
          $("#foundationTitle")
            .value
            .trim(),

        url,

        branchIds: [
          branch
        ],

        branchId:
          branch,

        subjectId:
          subject,

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
              (item) =>
                item.trim()
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

        updatedAt:
          serverTimestamp()

      };


      if (!data.title) {

        return msg(
          $("#foundationMsg"),
          "أدخل عنوان التأسيس.",
          true
        );

      }


      try {

        if (editing) {

          await updateDoc(
            doc(
              db,
              "foundations",
              editing
            ),
            data
          );

        } else {

          await addDoc(
            collection(
              db,
              "foundations"
            ),
            {
              ...data,
              createdAt:
                serverTimestamp()
            }
          );

        }


        editing = null;


        $("#foundationForm")
          .classList.add(
            "hidden"
          );


        await refresh();

      } catch (error) {

        console.error(
          "Foundation save error:",
          error
        );

        msg(
          $("#foundationMsg"),
          "فشل حفظ التأسيس:\n" +
          errorMessage(error),
          true
        );

      }

    };
}


/* =========================================================
   BULK IMPORT
========================================================= */

async function importItems(
  textSelector,
  collectionName,
  messageSelector,
  type
) {

  if (
    !can("content_admin")
  ) {

    return msg(
      $(messageSelector),
      "ليس لديك صلاحية للاستيراد الجماعي.",
      true
    );

  }


  const parsed =
    parseJSON(
      textSelector,
      messageSelector
    );

  let refs = {};
  let presets = {};
  let list = parsed;
  if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
    refs = parsed.refs || {};
    presets = parsed.presets || {};
    list = parsed[collectionName] || parsed.items || parsed.resources || parsed.foundations;
  }

  if (!Array.isArray(list)) {
    return msg($(messageSelector), "يجب أن يكون JSON Array أو Object يحتوي على resources/foundations.", true);
  }

  list = list.map(item => {
    if (!item || typeof item !== "object") return item;
    let copy = resolvePresetItem(item, refs, presets);
    ["branch","branchId","subject","subjectId","category","categoryId"].forEach(k => {
      if (k in copy) copy[k] = resolveRefValue(copy[k], refs);
    });
    if (Array.isArray(copy.branchIds)) copy.branchIds = copy.branchIds.map(v => resolveRefValue(v, refs));
    return copy;
  });

  if (!list.length) {

    return msg(
      $(messageSelector),
      "ملف JSON فارغ.",
      true
    );

  }


  msg(
    $(messageSelector),
    "جاري فحص البيانات والروابط...",
    false
  );


  let currentResources = [];
  let currentFoundations = [];


  try {

    const [
      resourcesSnap,
      foundationsSnap
    ] =
      await Promise.all([

        getDocs(
          collection(
            db,
            "resources"
          )
        ),

        getDocs(
          collection(
            db,
            "foundations"
          )
        )

      ]);


    currentResources =
      resourcesSnap.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );


    currentFoundations =
      foundationsSnap.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

  } catch (error) {

    console.error(
      "Bulk read error:",
      error
    );

    return msg(
      $(messageSelector),

      `فشل قراءة بيانات Firebase.

${errorMessage(error)}`,

      true
    );

  }


  /* =======================================================
     EXISTING URLS
  ======================================================= */

  const existingURLs =
    new Set();


  currentResources
    .forEach((item) => {

      const url =
        normalizeImportURL(
          item.url
        );

      if (url) {
        existingURLs.add(url);
      }

    });


  currentFoundations
    .forEach((item) => {

      const url =
        normalizeImportURL(
          item.url
        );

      if (url) {
        existingURLs.add(url);
      }

    });


  const validItems = [];

  const batchURLs =
    new Set();


  let duplicate = 0;
  let invalid = 0;

  const errors = [];


  /* =======================================================
     VALIDATE
  ======================================================= */

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
        `العنصر ${number}: البيانات ليست Object`
      );

      continue;
    }


    const originalURL =
      String(
        item.url ?? ""
      ).trim();


    if (!originalURL) {

      invalid++;

      errors.push(
        `العنصر ${number}: لا يوجد رابط`
      );

      continue;
    }


    try {

      new URL(
        originalURL
      );

    } catch {

      invalid++;

      errors.push(
        `العنصر ${number}: الرابط غير صالح`
      );

      continue;
    }


    const normalizedURL =
      normalizeImportURL(
        originalURL
      );


    const title =
      String(
        item.title ?? ""
      ).trim();


    if (!title) {

      invalid++;

      errors.push(
        `العنصر ${number}: لا يوجد عنوان`
      );

      continue;
    }


    const subjectId = resolveSubject(item.subjectId ?? item.subject ?? "");


    if (!subjectId) {

      invalid++;

      errors.push(
        `العنصر ${number}: لا يوجد subjectId`
      );

      continue;
    }


    /* =====================================================
       DUPLICATE DATABASE
    ===================================================== */

    if (
      existingURLs.has(
        normalizedURL
      )
    ) {

      duplicate++;

      errors.push(
        `العنصر ${number}: الرابط موجود مسبقًا`
      );

      continue;
    }


    /* =====================================================
       DUPLICATE SAME IMPORT
    ===================================================== */

    if (
      batchURLs.has(
        normalizedURL
      )
    ) {

      duplicate++;

      errors.push(
        `العنصر ${number}: الرابط مكرر داخل الاستيراد`
      );

      continue;
    }


    /* =====================================================
       BRANCH
    ===================================================== */

    let branchIds = [];


    if (
      Array.isArray(
        item.branchIds
      )
    ) {

      branchIds =
        item.branchIds
          .map((branch) => resolveBranch(branch))
          .filter(Boolean);

    }


    if (
      !branchIds.length &&
      item.branchId
    ) {

      branchIds = [resolveBranch(item.branchId || item.branch || "")].filter(Boolean);

    }


    let branchId = resolveBranch(item.branchId || item.branch || branchIds[0] || "");


    if (type === "resource" && !branchId) {
      const subject = subjects.find(s => s.id === subjectId);
      branchIds = arr(subject?.branchIds).map(resolveBranch).filter(Boolean);
      branchId = branchIds[0] || "";
    }

    if (type === "resource" && !branchIds.length) {
      invalid++;
      errors.push(`العنصر ${number}: اختر الفرع من خلال branch/branchId أو اجعل المادة مرتبطة بفروع.`);
      continue;
    }


    if (branchId && !branchIds.includes(branchId)) branchIds = [branchId, ...branchIds];

    if (
      type === "foundation" &&
      !branchIds.length
    ) {

      invalid++;

      errors.push(
        `العنصر ${number}: لا يوجد branchIds`
      );

      continue;
    }


    /* =====================================================
       KEYWORDS
    ===================================================== */

    let keywords = [];


    if (
      Array.isArray(
        item.keywords
      )
    ) {

      keywords =
        item.keywords
          .map(
            (keyword) =>
              String(
                keyword
              ).trim()
          )
          .filter(Boolean);

    } else {

      keywords =
        String(
          item.keywords ||
          ""
        )
          .split(",")
          .map(
            (keyword) =>
              keyword.trim()
          )
          .filter(Boolean);

    }


    /* =====================================================
       COPY DATA
    ===================================================== */

    const data = {
      ...item
    };


    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.status;
    delete data.reviewedAt;
    delete data.reviewedBy;


    data.title =
      title;

    data.url =
      originalURL;

    data.subjectId =
      subjectId;

    data.branchId =
      branchId;

    data.branchIds =
      branchIds;

    data.keywords =
      keywords;

    data.order =
      Number(
        item.order
      ) || 9999;


    /* =====================================================
       RESOURCE
    ===================================================== */

    if (
      type === "resource"
    ) {

      data.type =
        String(
          item.type ||
          ""
        ).trim();

      data.categoryId = resolveCategory(item.categoryId ?? item.category ?? "");
      data.category = categoryName(data.categoryId);

    }


    /* =====================================================
       FOUNDATION
    ===================================================== */

    if (
      type === "foundation"
    ) {

      data.level =
        item.level ||
        "beginner";

      data.type =
        item.type ||
        "lesson";

    }


    data.createdAt =
      serverTimestamp();

    data.updatedAt =
      serverTimestamp();


    batchURLs.add(
      normalizedURL
    );


    validItems.push(
      data
    );

  }


  /* =======================================================
     NOTHING VALID
  ======================================================= */

  if (
    !validItems.length
  ) {

    console.error(
      "Bulk validation errors:",
      errors
    );


    return msg(
      $(messageSelector),

      `لم تتم إضافة أي عنصر.

تم فحص:
${list.length}

المكرر:
${duplicate}

غير الصالح:
${invalid}

${errors
  .slice(0, 10)
  .join("\n")}`,

      true
    );

  }


  /* =======================================================
     FIRESTORE BATCH
  ======================================================= */

  const CHUNK_SIZE =
    450;


  let added = 0;


  try {

    for (
      let start = 0;
      start <
      validItems.length;
      start +=
        CHUNK_SIZE
    ) {

      const chunk =
        validItems.slice(
          start,
          start +
            CHUNK_SIZE
        );


      const batch =
        writeBatch(db);


      chunk.forEach(
        (data) => {

          const reference =
            doc(
              collection(
                db,
                collectionName
              )
            );


          batch.set(
            reference,
            data
          );

        }
      );


      await batch.commit();


      added +=
        chunk.length;


      msg(
        $(messageSelector),

        `جاري الاستيراد...

تم حفظ:
${added} من ${validItems.length}`,

        false
      );

    }

  } catch (error) {

    console.error(
      "Bulk Firestore error:",
      error
    );


    return msg(
      $(messageSelector),

      `حدث خطأ أثناء الحفظ.

الخطأ:
${errorMessage(error)}

تم حفظ:
${added}`,

      true
    );

  }


  /* =======================================================
     SUCCESS
  ======================================================= */

  msg(
    $(messageSelector),

    `تم الاستيراد بنجاح.

تم فحص:
${list.length}

تمت الإضافة:
${added}

تم تجاهل المكرر:
${duplicate}

غير الصالح:
${invalid}`,

    false
  );


  await refresh();
}


/* =========================================================
   BULK BUTTONS
========================================================= */

if (typeof document !== "undefined") {
  document.addEventListener("click", async (event) => {
    if (event.target.closest("#generateImportTemplate")) generateImportTemplate();
    if (event.target.closest("#generateGeneralImportTemplate")) generateGeneralImportTemplate();
    if (event.target.closest("#copyImportTemplate")) {
      const el = $("#generatedImportTemplate");
      if (!el?.value) return msg($("#templateMsg"), "ولّد القالب أولًا.", true);
      try { await navigator.clipboard.writeText(el.value); msg($("#templateMsg"), "تم نسخ القالب.", false); }
      catch { el.select(); document.execCommand("copy"); msg($("#templateMsg"), "تم نسخ القالب.", false); }
    }
  });
}

if (typeof window !== "undefined") {
  window.generateImportTemplate = generateImportTemplate;
  window.generateGeneralImportTemplate = generateGeneralImportTemplate;
}

if ($("#importResources")) {

  $("#importResources")
    .onclick =
    () =>
      importItems(
        "#bulkResources",
        "resources",
        "#bulkResourceMsg",
        "resource"
      );

}


if ($("#importFoundations")) {

  $("#importFoundations")
    .onclick =
    () =>
      importItems(
        "#bulkFoundations",
        "foundations",
        "#bulkFoundationMsg",
        "foundation"
      );

}


/* =========================================================
   ADMIN MANAGEMENT
========================================================= */

$("#addAdminBtn")
  ?.addEventListener(
    "click",
    () => {

      if (
        role !== "superadmin"
      ) {

        alert(
          "هذه العملية لـ Super Admin فقط."
        );

        return;
      }


      $("#adminForm")
        ?.classList.remove(
          "hidden"
        );

    }
  );


$("#cancelAdmin")
  ?.addEventListener(
    "click",
    () => {

      $("#adminForm")
        ?.classList.add(
          "hidden"
        );

    }
  );


$("#adminForm")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (
        role !== "superadmin"
      ) {

        return msg(
          $("#adminMsg"),
          "هذه العملية لـ Super Admin فقط.",
          true
        );

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


      const adminData = {

        role:
          $("#adminRole")
            .value,

        active:
          $("#adminActive")
            .checked,

        updatedAt:
          serverTimestamp()

      };


      try {

        const adminRef =
          doc(
            db,
            "admins",
            uid
          );


        const existing =
          await getDoc(
            adminRef
          );


        if (
          existing.exists()
        ) {

          await updateDoc(
            adminRef,
            adminData
          );

        } else {

          await setDoc(
            adminRef,
            {
              ...adminData,

              createdAt:
                serverTimestamp()
            }
          );

        }


        msg(
          $("#adminMsg"),
          "تم حفظ الأدمن بنجاح.",
          false
        );


        $("#adminForm")
          .classList.add(
            "hidden"
          );


        $("#adminUid")
          .value = "";


        await refresh();

      } catch (error) {

        console.error(
          "Admin save error:",
          error
        );

        msg(
          $("#adminMsg"),
          "فشل حفظ الأدمن:\n" +
          errorMessage(error),
          true
        );

      }

    }
  );


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

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

      role =
        await loadRole(
          user
        );


      $("#loginSection")
        ?.classList.add(
          "hidden"
        );


      $("#dashboard")
        ?.classList.remove(
          "hidden"
        );


      if ($("#adminEmail")) {

        $("#adminEmail")
          .textContent =
          user.email ||
          user.uid;

      }


      if ($("#roleBadge")) {

        $("#roleBadge")
          .textContent =
          role;

      }


      await refresh();


    } catch (error) {

      console.error(
        "Admin authentication error:",
        error
      );


      role = null;


      try {

        await signOut(
          auth
        );

      } catch {}


      $("#loginSection")
        ?.classList.remove(
          "hidden"
        );


      $("#dashboard")
        ?.classList.add(
          "hidden"
        );


      msg(
        $("#loginMsg"),
        "هذا الحساب ليس لديه صلاحية أدمن.",
        true
      );

    }

  }
);