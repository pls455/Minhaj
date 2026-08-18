import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  query,
  where,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const esc = v =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const arr = v =>
  Array.isArray(v) ? v : (v ? [v] : []);

const safeUrl = v => {
  try {
    const u = new URL(v);
    return /^https?:$/.test(u.protocol) ? u.href : "#";
  } catch {
    return "#";
  }
};

const textOf = x =>
  [
    x.title,
    x.name,
    x.description,
    x.type,
    x.category,
    x.categoryId,
    x.keywords,
    x.tags,
    x.author
  ]
    .flat(Infinity)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

let branches = [];
let categories = [];
let subjects = [];


/* =====================================================
   META
   ===================================================== */

async function loadMeta() {

  const cached = localStorage.getItem("minhaj:meta");

  try {

    const [
      b,
      c,
      s
    ] = await Promise.all([

      getDocs(
        query(
          collection(db, "branches"),
          limit(200)
        )
      ),

      getDocs(
        query(
          collection(db, "categories"),
          limit(200)
        )
      ),

      getDocs(
        query(
          collection(db, "subjects"),
          limit(500)
        )
      )

    ]);

    branches = b.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(x => x.active !== false)
      .sort(
        (a, z) =>
          (a.order ?? 9999) -
          (z.order ?? 9999)
      );

    categories = c.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(x => x.active !== false)
      .sort(
        (a, z) =>
          (a.order ?? 9999) -
          (z.order ?? 9999)
      );

    subjects = s.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .sort(
        (a, z) =>
          (a.order ?? 9999) -
          (z.order ?? 9999)
      );

    localStorage.setItem(
      "minhaj:meta",
      JSON.stringify({
        branches,
        categories,
        subjects
      })
    );

  } catch (e) {

    console.error(
      "فشل تحميل البيانات الأساسية:",
      e
    );

    if (cached) {

      try {

        ({
          branches,
          categories,
          subjects
        } = JSON.parse(cached));

      } catch {}

    }

  }

}


/* =====================================================
   HELPERS
   ===================================================== */

const branchName = id =>
  branches.find(
    x =>
      x.id === id ||
      x.stableId === id
  )?.name || id;

const categoryName = id =>
  categories.find(
    x =>
      x.id === id ||
      x.stableId === id
  )?.name || id;

const branchIds = x => {

  const a = arr(x?.branchIds);

  return a.length
    ? a
    : arr(x?.branchId);

};

const subjectBranches = s =>
  branchIds(s);


/* =====================================================
   NAV
   ===================================================== */

function setupNav() {

  const b = $(".menu-btn");
  const n = document.querySelector("nav");

  if (b && n) {

    b.onclick = () =>
      n.classList.toggle("open");

  }

}


/* =====================================================
   SELECTS
   ===================================================== */

function fillBranchSelect(
  sel,
  allLabel = "كل الفروع"
) {

  if (!sel) return;

  const old = sel.value;

  sel.innerHTML =
    `<option value="">${allLabel}</option>` +

    branches
      .map(
        b =>
          `<option value="${esc(b.id)}">
            ${esc(b.name)}
          </option>`
      )
      .join("");

  if (old)
    sel.value = old;

}


function fillSubjectSelect(
  sel,
  branch = "",
  allLabel = "كل المواد"
) {

  if (!sel) return;

  const old = sel.value;

  const list =
    subjects.filter(
      s =>
        !branch ||
        subjectBranches(s).includes(branch)
    );

  sel.innerHTML =
    `<option value="">${allLabel}</option>` +

    list
      .map(
        s =>
          `<option value="${esc(s.id)}">
            ${esc(s.name)}
          </option>`
      )
      .join("");

  if (
    old &&
    list.some(
      s => s.id === old
    )
  ) {

    sel.value = old;

  }

}


function fillCategorySelect(sel) {

  if (!sel) return;

  const old = sel.value;

  sel.innerHTML =
    '<option value="">كل التصنيفات</option>' +

    categories
      .map(
        c =>
          `<option value="${esc(c.id)}">
            ${esc(c.icon || "")}
            ${esc(c.name)}
          </option>`
      )
      .join("");

  if (old)
    sel.value = old;

}


/* =====================================================
   RESOURCES
   ===================================================== */

/*
   عند وجود subject:
   كل طلب = 10 مصادر فقط.

   startAfter(lastDoc):
   يكمل من آخر مصدر تم تحميله.

   عند عدم وجود subject:
   نحافظ على السلوك القديم.
*/

async function getResources({
  branch = "",
  subject = "",
  lastDoc = null
} = {}) {

  try {

    let q = collection(
      db,
      "resources"
    );

    if (subject) {

      const constraints = [
        where(
          "subjectId",
          "==",
          subject
        )
      ];

      if (lastDoc) {

        constraints.push(
          startAfter(lastDoc)
        );

      }

      constraints.push(
        limit(10)
      );

      q = query(
        q,
        ...constraints
      );

    } else {

      q = query(
        q,
        limit(500)
      );

    }

    const snap =
      await getDocs(q);

    const data =
      snap.docs
        .map(d => ({
          id: d.id,
          ...d.data(),

          // نخزن آخر Document
          // لاستخدامه في تحميل المزيد
          _doc: d
        }))
        .filter(
          x => x.active !== false
        );

    return {

      data,

      lastDoc:
        snap.docs[
          snap.docs.length - 1
        ] || null,

      hasMore:
        subject &&
        snap.docs.length === 10

    };

  } catch (e) {

    console.error(
      "خطأ في تحميل المصادر:",
      e
    );

    return {
      data: [],
      lastDoc: null,
      hasMore: false
    };

  }

}


/* =====================================================
   FOUNDATIONS
   ===================================================== */

async function getFoundations({
  branch = "",
  subject = ""
} = {}) {

  const key =
    `minhaj:foundations:${branch}:${subject}`;

  const cached =
    localStorage.getItem(key);

  try {

    let q =
      collection(
        db,
        "foundations"
      );

    if (subject) {

      q = query(
        q,
        where(
          "subjectId",
          "==",
          subject
        ),
        limit(500)
      );

    } else {

      q = query(
        q,
        limit(500)
      );

    }

    const s =
      await getDocs(q);

    const d =
      s.docs.map(
        x => ({
          id: x.id,
          ...x.data()
        })
      );

    localStorage.setItem(
      key,
      JSON.stringify(d)
    );

    return d;

  } catch {

    return cached
      ? JSON.parse(cached)
      : [];

  }

}


/* =====================================================
   SUBJECTS PAGE
   ===================================================== */

async function renderSubjects() {

  const grid =
    $("#subjectsGrid");

  if (!grid) return;

  fillBranchSelect(null);

  const filters =
    $$("[data-branch]");

  let branch =
    new URLSearchParams(
      location.search
    ).get("branch") || "";

  filters.forEach(b => {

    if (
      !branches.some(
        x =>
          x.id ===
          b.dataset.branch
      ) &&
      b.dataset.branch
    ) {

      b.hidden = true;

    }

    b.classList.toggle(
      "active",
      b.dataset.branch === branch
    );

    b.onclick = () => {

      branch =
        b.dataset.branch;

      history.replaceState(
        {},
        "",
        `subjects.html${
          branch
            ? `?branch=${encodeURIComponent(branch)}`
            : ""
        }`
      );

      render();

    };

  });


  function render() {

    grid.innerHTML =
      '<div class="loading">جاري تحميل المواد...</div>';

    const list =
      subjects.filter(
        s =>
          !branch ||
          subjectBranches(s)
            .includes(branch)
      );

    grid.innerHTML =
      list.length

        ? list
            .map(
              (s, i) =>
                `
                <a
                  class="subject-card"
                  href="resources.html?branch=${encodeURIComponent(
                    branch ||
                    subjectBranches(s)[0] ||
                    ""
                  )}&subject=${encodeURIComponent(s.id)}"
                >

                  <small>
                    ${String(i + 1).padStart(2, "0")}
                  </small>

                  <div class="subject-icon">
                    ${esc(s.icon || "📚")}
                  </div>

                  <h3>
                    ${esc(s.name)}
                  </h3>

                  <p>
                    ${esc(
                      s.description ||
                      "مصادر ومراجع دراسية"
                    )}
                  </p>

                  ${
                    subjectBranches(s).length > 1
                      ? '<span class="tag shared">مشتركة</span>'
                      : ""
                  }

                </a>
                `
            )
            .join("")

        : '<div class="empty">لا توجد مواد لهذا الفرع حاليًا.</div>';

  }

  render();

}


/* =====================================================
   RESOURCES PAGE
   ===================================================== */

async function renderResources() {

  const grid =
    $("#resourcesGrid");

  if (!grid) return;

  const p =
    new URLSearchParams(
      location.search
    );

  let branch =
    p.get("branch") || "";

  let subject =
    p.get("subject") || "";

  const search =
    $("#searchInput");

  const bs =
    $("#branchSelect");

  const ss =
    $("#subjectSelect");

  const ts =
    $("#typeSelect");

  const cs =
    $("#categorySelect");


  fillBranchSelect(bs);

  fillCategorySelect(cs);

  if (bs)
    bs.value = branch;

  fillSubjectSelect(
    ss,
    branch
  );

  if (ss)
    ss.value = subject;


  /* =================================================
     PAGINATION STATE
     ================================================= */

  let all = [];

  let lastDoc = null;

  let hasMore = false;

  let loadingMore = false;


  /* =================================================
     LOAD FIRST 10
     ================================================= */

  async function loadFirstPage() {

    grid.innerHTML =
      '<div class="loading">جاري تحميل المصادر...</div>';

    all = [];

    lastDoc = null;

    hasMore = false;


    const result =
      await getResources({
        branch,
        subject
      });


    all =
      result.data;

    lastDoc =
      result.lastDoc;

    hasMore =
      result.hasMore;


    updateTypes();

    render();

  }


  /* =================================================
     LOAD MORE
     ================================================= */

  async function loadMore() {

    if (
      loadingMore ||
      !hasMore ||
      !subject
    ) {

      return;

    }

    loadingMore = true;


    const button =
      $("#loadMoreBtn");


    if (button) {

      button.disabled = true;

      button.textContent =
        "جاري التحميل...";

    }


    const result =
      await getResources({
        branch,
        subject,
        lastDoc
      });


    all.push(
      ...result.data
    );


    lastDoc =
      result.lastDoc;

    hasMore =
      result.hasMore;

    loadingMore = false;


    updateTypes();

    render();

  }


  /* =================================================
     TYPES
     ================================================= */

  function updateTypes() {

    if (!ts) return;

    const current =
      ts.value;


    const types =
      [
        ...new Set(
          all
            .map(x => x.type)
            .filter(Boolean)
        )
      ];


    ts.innerHTML =
      '<option value="">كل الأنواع</option>' +

      types
        .map(
          t =>
            `<option value="${esc(t)}">
              ${esc(t)}
            </option>`
        )
        .join("");


    if (
      types.includes(current)
    ) {

      ts.value = current;

    }

  }


  /* =================================================
     RENDER
     ================================================= */

  function render() {

    const q =
      (search?.value || "")
        .trim()
        .toLowerCase();

    const b =
      bs?.value || "";

    const s =
      ss?.value || "";

    const t =
      ts?.value || "";

    const c =
      cs?.value || "";


    const out =
      all
        .filter(
          x =>
            (!q ||
              textOf(x)
                .includes(q)) &&

            (!b ||
              branchIds(x)
                .includes(b)) &&

            (!s ||
              x.subjectId === s) &&

            (!t ||
              x.type === t) &&

            (!c ||
              x.categoryId === c)
        )
        .sort(
          (a, z) =>
            (a.order ?? 9999) -
            (z.order ?? 9999)
        );


    if (!out.length) {

      grid.innerHTML =
        '<div class="empty">لا توجد مصادر مطابقة.</div>';

      return;

    }


    grid.innerHTML =
      out
        .map(
          x =>
            `
            <a
              class="resource-card"
              href="${safeUrl(x.url)}"
              target="_blank"
              rel="noopener noreferrer"
            >

              <div class="resource-cover">
                ${esc(x.icon || "📖")}
              </div>

              <div>

                <span class="tag">
                  ${esc(
                    x.type ||
                    categoryName(
                      x.categoryId
                    ) ||
                    "مصدر"
                  )}
                </span>

                <h3>
                  ${esc(
                    x.title ||
                    "مصدر"
                  )}
                </h3>

                <p>
                  ${esc(
                    x.description ||
                    "فتح المصدر"
                  )}
                </p>

                <small>
                  ${esc(
                    categoryName(
                      x.categoryId
                    ) || ""
                  )}
                  ·
                  ${esc(
                    branchIds(x)
                      .map(branchName)
                      .join("، ")
                  )}
                </small>

              </div>

              <strong>
                ↗
              </strong>

            </a>
            `
        )
        .join("");


    /* =================================================
       LOAD MORE BUTTON
       ================================================= */

    if (
      subject &&
      hasMore
    ) {

      grid.insertAdjacentHTML(
        "beforeend",
        `
        <div class="load-more-wrap">

          <button
            id="loadMoreBtn"
            class="load-more-btn"
            type="button"
          >
            تحميل المزيد
          </button>

        </div>
        `
      );


      $("#loadMoreBtn")
        ?.addEventListener(
          "click",
          loadMore
        );


    } else if (
      subject &&
      all.length
    ) {

      grid.insertAdjacentHTML(
        "beforeend",
        `
        <div class="load-more-wrap">

          <div class="no-more">
            لا توجد مصادر إضافية
          </div>

        </div>
        `
      );

    }

  }


  /* =================================================
     RELOAD
     ================================================= */

  async function reload() {

    branch =
      bs?.value || "";

    subject =
      ss?.value || "";


    fillSubjectSelect(
      ss,
      branch
    );


    if (
      subject &&
      [...ss.options]
        .every(
          o =>
            o.value !== subject
        )
    ) {

      subject = "";

    }


    await loadFirstPage();

  }


  /* =================================================
     SEARCH
     ================================================= */

  [
    search,
    ts,
    cs
  ]
    .filter(Boolean)
    .forEach(
      e =>
        e.addEventListener(
          "input",
          render
        )
    );


  /* =================================================
     BRANCH
     ================================================= */

  bs?.addEventListener(
    "change",
    reload
  );


  /* =================================================
     SUBJECT
     ================================================= */

  ss?.addEventListener(
    "change",
    async () => {

      subject =
        ss.value;

      await loadFirstPage();

    }
  );


  /* =================================================
     INITIAL LOAD
     ================================================= */

  await loadFirstPage();

}


/* =====================================================
   FOUNDATIONS PAGE
   ===================================================== */

async function renderFoundations() {

  const grid =
    $("#foundationsGrid");

  if (!grid) return;

  const bs =
    $("#foundationBranch");

  const ss =
    $("#foundationSubject");

  const ls =
    $("#foundationLevel");

  const ts =
    $("#foundationType");

  const search =
    $("#foundationSearch");


  fillBranchSelect(bs);


  let branch =
    bs.value =
      new URLSearchParams(
        location.search
      ).get("branch") || "";


  fillSubjectSelect(
    ss,
    branch
  );


  let data =
    await getFoundations({
      branch
    });


  async function reload() {

    branch =
      bs.value;

    fillSubjectSelect(
      ss,
      branch
    );


    data =
      await getFoundations({
        branch,
        subject:
          ss.value
      });


    render();

  }


  function render() {

    const q =
      (search?.value || "")
        .trim()
        .toLowerCase();

    const s =
      ss?.value || "";

    const l =
      ls?.value || "";

    const t =
      ts?.value || "";


    const out =
      data.filter(
        x =>

          (!q ||
            textOf(x)
              .includes(q)) &&

          (!s ||
            x.subjectId === s) &&

          (!l ||
            x.level === l) &&

          (!t ||
            x.type === t) &&

          (!branch ||
            branchIds(x)
              .includes(branch))
      );


    grid.innerHTML =
      out.length

        ? out
            .map(
              x =>
                `
                <a
                  class="resource-card foundation-card"
                  href="${safeUrl(x.url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >

                  <div class="resource-cover">
                    🧠
                  </div>

                  <div>

                    <span class="tag">
                      ${esc(
                        x.level ||
                        "تأسيس"
                      )}
                    </span>

                    <h3>
                      ${esc(
                        x.title
                      )}
                    </h3>

                    <p>
                      ${esc(
                        x.description ||
                        "ابدأ التأسيس"
                      )}
                    </p>

                    <small>
                      ${esc(
                        x.type || ""
                      )}
                      ·
                      ${esc(
                        branchIds(x)
                          .map(branchName)
                          .join("، ")
                      )}
                    </small>

                  </div>

                  <strong>
                    ↗
                  </strong>

                </a>
                `
            )
            .join("")

        : '<div class="empty">لا يوجد محتوى تأسيس مطابق.</div>';

  }


  bs?.addEventListener(
    "change",
    reload
  );


  ss?.addEventListener(
    "change",
    async () => {

      data =
        await getFoundations({
          branch,
          subject:
            ss.value
        });

      render();

    }
  );


  [
    ls,
    ts,
    search
  ]
    .filter(Boolean)
    .forEach(
      e =>
        e.addEventListener(
          "input",
          render
        )
    );


  render();

}


/* =====================================================
   START
   ===================================================== */

setupNav();

loadMeta()
  .then(() => {

    renderSubjects();

    renderResources();

    renderFoundations();

  });


/* =====================================================
   SERVICE WORKER
   ===================================================== */

if ("serviceWorker" in navigator) {

  navigator.serviceWorker
    .register("sw.js")
    .catch(console.error);

}