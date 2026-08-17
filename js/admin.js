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

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const arr = (v) =>
  Array.isArray(v) ? v : (v ? [v] : []);

const branches = {
  scientific: "العلمي",
  literary: "الأدبي",
  industrial: "الصناعي"
};

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
  return (roleLevel[role] || 0) >= (roleLevel[requiredRole] || 0);
}


/* =========================================================
   MESSAGES
========================================================= */

function msg(el, text, error = false) {
  if (!el) return;

  el.textContent = text;
  el.className = error
    ? "message error"
    : "message success";
}


/* =========================================================
   BRANCHES
========================================================= */

function branchesHTML(ids = []) {
  return arr(ids)
    .map((x) => branches[x] || x)
    .join("، ") || "غير محدد";
}


/* =========================================================
   ADMIN ROLE
========================================================= */

async function loadRole(user) {
  const snap = await getDoc(
    doc(db, "admins", user.uid)
  );

  if (
    !snap.exists() ||
    snap.data().active !== true
  ) {
    throw new Error("NO_ADMIN");
  }

  return snap.data().role || "reviewer";
}


/* =========================================================
   LOAD COLLECTION
========================================================= */

async function all(collectionName) {
  const snap = await getDocs(
    collection(db, collectionName)
  );

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));
}


/* =========================================================
   REFRESH DATA
========================================================= */

async function refresh() {
  const results = await Promise.all([
    all("subjects"),
    all("resources"),
    all("foundations"),

    getDocs(
      query(
        collection(db, "suggestions"),
        where("status", "==", "pending"),
        limit(300)
      )
    ).then((snap) =>
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }))
    )
  ]);

  subjects = results[0];
  resources = results[1];
  foundations = results[2];
  suggestions = results[3];

  if (role === "superadmin") {
    admins = await all("admins");
  }

  $("#subjectsCount").textContent =
    subjects.length;

  $("#resourcesCount").textContent =
    resources.length;

  $("#foundationsCount").textContent =
    foundations.length;

  $("#suggestionsCount").textContent =
    suggestions.length;

  renderAll();
}


/* =========================================================
   SUBJECT OPTIONS
========================================================= */

function subjectOptions(branch = "") {
  return subjects
    .filter((s) => {
      if (!branch) return true;

      return arr(s.branchIds).includes(branch);
    })
    .sort(
      (a, b) =>
        (a.order ?? 9999) -
        (b.order ?? 9999)
    )
    .map(
      (s) =>
        `<option value="${esc(s.id)}">${esc(s.name)}</option>`
    )
    .join("");
}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

  /* =========================
     SUBJECTS
  ========================= */

  $("#subjectsList").innerHTML =
    [...subjects]
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        (s) => `
          <div class="admin-item">
            <div>
              <strong>${esc(s.name)}</strong>
              <p>
                ${branchesHTML(s.branchIds)}
                · ترتيب ${s.order ?? "-"}
              </p>
            </div>

            <div>
              <button
                class="btn small"
                data-edit-sub="${esc(s.id)}">
                تعديل
              </button>

              <button
                class="btn danger small"
                data-del-sub="${esc(s.id)}">
                حذف
              </button>
            </div>
          </div>
        `
      )
      .join("") ||
    '<div class="empty">لا توجد مواد.</div>';


  /* =========================
     RESOURCES
  ========================= */

  $("#resourcesList").innerHTML =
    [...resources]
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        (r) => `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(r.title)}
              </strong>

              <p>
                ${
                  branches[r.branchId] ||
                  branchesHTML(r.branchIds)
                }

                ·

                ${esc(r.type || "مصدر")}

                ·

                <a
                  href="${esc(r.url)}"
                  target="_blank"
                  rel="noopener">
                  الرابط
                </a>
              </p>

            </div>

            <div>

              <button
                class="btn small"
                data-edit-res="${esc(r.id)}">
                تعديل
              </button>

              <button
                class="btn danger small"
                data-del-res="${esc(r.id)}">
                حذف
              </button>

            </div>

          </div>
        `
      )
      .join("") ||
    '<div class="empty">لا توجد مصادر.</div>';


  /* =========================
     FOUNDATIONS
  ========================= */

  $("#foundationsList").innerHTML =
    [...foundations]
      .sort(
        (a, b) =>
          (a.order ?? 9999) -
          (b.order ?? 9999)
      )
      .map(
        (r) => `
          <div class="admin-item">

            <div>

              <strong>
                🧠 ${esc(r.title)}
              </strong>

              <p>
                ${branchesHTML(r.branchIds)}

                ·

                ${esc(r.level || "")}

                ·

                ${esc(r.type || "")}

                ·

                <a
                  href="${esc(r.url)}"
                  target="_blank"
                  rel="noopener">
                  الرابط
                </a>
              </p>

            </div>

            <div>

              <button
                class="btn small"
                data-edit-found="${esc(r.id)}">
                تعديل
              </button>

              <button
                class="btn danger small"
                data-del-found="${esc(r.id)}">
                حذف
              </button>

            </div>

          </div>
        `
      )
      .join("") ||
    '<div class="empty">لا يوجد تأسيس.</div>';


  /* =========================
     SUGGESTIONS
  ========================= */

  $("#suggestionsList").innerHTML =
    suggestions
      .map(
        (s) => `
          <div class="admin-item suggestion">

            <div>

              <strong>
                ${esc(s.title)}
              </strong>

              <p>
                ${
                  s.contentType === "foundation"
                    ? "🧠 تأسيس"
                    : "📚 مصدر"
                }

                ·

                ${branchesHTML(s.branchIds)}

                · الطالب:

                ${esc(
                  s.studentName ||
                  "غير محدد"
                )}
              </p>

              <p>
                ${esc(s.description || "")}
              </p>

              <a
                href="${esc(s.url)}"
                target="_blank"
                rel="noopener">
                فتح الرابط
              </a>

            </div>

            <div>

              <button
                class="btn primary small"
                data-approve="${esc(s.id)}">
                ✅ موافقة
              </button>

              <button
                class="btn danger small"
                data-reject="${esc(s.id)}">
                ❌ رفض
              </button>

            </div>

          </div>
        `
      )
      .join("") ||
    '<div class="empty">لا توجد اقتراحات معلقة.</div>';


  /* =========================
     RECENT SUGGESTIONS
  ========================= */

  $("#recentSuggestions").innerHTML =
    suggestions
      .slice(0, 5)
      .map(
        (s) => `
          <div class="admin-item">

            <div>

              <strong>
                ${esc(s.title)}
              </strong>

              <p>
                قيد المراجعة ·
                ${esc(
                  s.studentName ||
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


  /* =========================
     SUPER ADMIN
  ========================= */

  $$(".super-only").forEach((element) => {
    element.classList.toggle(
      "hidden",
      role !== "superadmin"
    );
  });


  if ($("#adminsList")) {

    $("#adminsList").innerHTML =
      role === "superadmin"

        ? (
            admins
              .map(
                (a) => `
                  <div class="admin-item">

                    <div>

                      <strong>
                        ${esc(
                          a.email ||
                          a.id
                        )}
                      </strong>

                      <p>
                        ${esc(
                          a.role ||
                          "reviewer"
                        )}

                        ·

                        ${
                          a.active
                            ? "نشط"
                            : "موقوف"
                        }

                        · UID:

                        ${esc(a.id)}
                      </p>

                    </div>

                    <button
                      class="btn danger small"
                      data-del-admin="${esc(a.id)}">
                      تعطيل
                    </button>

                  </div>
                `
              )
              .join("") ||
            '<div class="empty">لا يوجد أدمن.</div>'
          )

        : "";
  }
}


/* =========================================================
   TABS
========================================================= */

function openTab(name) {

  $$(".admin-tab").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.tab === name
    );
  });

  $$(".admin-panel").forEach((panel) => {
    panel.classList.add("hidden");
  });

  $("#" + name + "Panel")
    ?.classList.remove("hidden");
}


$$(".admin-tab").forEach((button) => {

  button.onclick = () => {

    if (
      button.classList.contains("hidden")
    ) {
      return;
    }

    openTab(button.dataset.tab);
  };

});


/* =========================================================
   DELETE / EDIT / ACTIONS
========================================================= */

document.addEventListener(
  "click",
  async (e) => {

    const t = e.target;


    /* TAB JUMP */

    if (t.dataset.tabjump) {
      openTab(t.dataset.tabjump);
      return;
    }


    /* DELETE SUBJECT */

    if (t.dataset.delSub) {

      if (
        !confirm("حذف المادة؟")
      ) {
        return;
      }

      if (!can("content_admin")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      await deleteDoc(
        doc(
          db,
          "subjects",
          t.dataset.delSub
        )
      );

      await refresh();
      return;
    }


    /* DELETE RESOURCE */

    if (t.dataset.delRes) {

      if (
        !confirm("حذف المصدر؟")
      ) {
        return;
      }

      if (!can("content_admin")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      await deleteDoc(
        doc(
          db,
          "resources",
          t.dataset.delRes
        )
      );

      await refresh();
      return;
    }


    /* DELETE FOUNDATION */

    if (t.dataset.delFound) {

      if (
        !confirm("حذف التأسيس؟")
      ) {
        return;
      }

      if (!can("content_admin")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      await deleteDoc(
        doc(
          db,
          "foundations",
          t.dataset.delFound
        )
      );

      await refresh();
      return;
    }


    /* APPROVE */

    if (t.dataset.approve) {

      if (!can("reviewer")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      await review(
        t.dataset.approve,
        true
      );

      return;
    }


    /* REJECT */

    if (t.dataset.reject) {

      if (!can("reviewer")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      await review(
        t.dataset.reject,
        false
      );

      return;
    }


    /* EDIT SUBJECT */

    if (t.dataset.editSub) {
      editSubject(
        t.dataset.editSub
      );
      return;
    }


    /* EDIT RESOURCE */

    if (t.dataset.editRes) {
      editResource(
        t.dataset.editRes
      );
      return;
    }


    /* EDIT FOUNDATION */

    if (t.dataset.editFound) {
      editFoundation(
        t.dataset.editFound
      );
      return;
    }


    /* DISABLE ADMIN */

    if (t.dataset.delAdmin) {

      if (
        !confirm(
          "تعطيل هذا الأدمن؟"
        )
      ) {
        return;
      }

      if (role !== "superadmin") {
        alert(
          "هذه العملية لـ Super Admin فقط."
        );
        return;
      }

      await updateDoc(
        doc(
          db,
          "admins",
          t.dataset.delAdmin
        ),
        {
          active: false,
          updatedAt:
            serverTimestamp()
        }
      );

      await refresh();
      return;
    }


    /* ADD SUBJECT */

    if (t.id === "addSubjectBtn") {

      if (!can("content_admin")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      editing = null;

      $("#subjectForm")
        .classList.remove("hidden");

      return;
    }


    /* CANCEL SUBJECT */

    if (t.id === "cancelSubject") {
      $("#subjectForm")
        .classList.add("hidden");
      return;
    }


    /* ADD RESOURCE */

    if (t.id === "addResourceBtn") {

      if (!can("content_admin")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      editing = null;

      $("#resourceForm")
        .classList.remove("hidden");

      return;
    }


    /* CANCEL RESOURCE */

    if (t.id === "cancelResource") {

      $("#resourceForm")
        .classList.add("hidden");

      return;
    }


    /* ADD FOUNDATION */

    if (t.id === "addFoundationBtn") {

      if (!can("content_admin")) {
        alert("ليس لديك صلاحية.");
        return;
      }

      editing = null;

      $("#foundationForm")
        .classList.remove("hidden");

      return;
    }


    /* CANCEL FOUNDATION */

    if (t.id === "cancelFoundation") {

      $("#foundationForm")
        .classList.add("hidden");

      return;
    }

  }
);


/* =========================================================
   REVIEW SUGGESTION
   النظام موجود في حال كانت collection موجودة،
   لكننا لن نستخدم صفحة الطالب الجديدة.
========================================================= */

async function review(id, approve) {

  const s =
    suggestions.find(
      (x) => x.id === id
    );

  if (!s) return;

  const data = {
    ...s
  };

  delete data.id;
  delete data.status;

  delete data.createdAt;

  if (approve) {

    data.createdAt =
      serverTimestamp();

    data.updatedAt =
      serverTimestamp();

    if (
      s.contentType ===
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
      status: approve
        ? "approved"
        : "rejected",

      reviewedAt:
        serverTimestamp(),

      reviewedBy:
        auth.currentUser.uid
    }
  );

  await refresh();
}


/* =========================================================
   EDIT SUBJECT
========================================================= */

function editSubject(id) {

  if (!can("content_admin")) {
    alert("ليس لديك صلاحية.");
    return;
  }

  editing = id;

  const s =
    subjects.find(
      (x) => x.id === id
    );

  if (!s) return;

  $("#subjectName").value =
    s.name || "";

  $("#subjectOrder").value =
    s.order ?? "";

  $("#subjectDescription").value =
    s.description || "";

  $$("#subjectForm input[type=checkbox]")
    .forEach((checkbox) => {

      checkbox.checked =
        arr(s.branchIds)
          .includes(
            checkbox.value
          );

    });

  $("#subjectForm")
    .classList.remove("hidden");

  openTab("subjects");
}


/* =========================================================
   EDIT RESOURCE
========================================================= */

function editResource(id) {

  if (!can("content_admin")) {
    alert("ليس لديك صلاحية.");
    return;
  }

  editing = id;

  const r =
    resources.find(
      (x) => x.id === id
    );

  if (!r) return;

  $("#resourceTitle").value =
    r.title || "";

  $("#resourceUrl").value =
    r.url || "";

  $("#resourceBranch").value =
    r.branchId ||
    arr(r.branchIds)[0] ||
    "";

  $("#resourceSubject").innerHTML =
    '<option value="">اختر المادة</option>' +
    subjectOptions(
      $("#resourceBranch").value
    );

  $("#resourceSubject").value =
    r.subjectId || "";

  $("#resourceType").value =
    r.type || "";

  $("#resourceCategory").value =
    r.category ||
    r.categoryId ||
    "";

  $("#resourceKeywords").value =
    arr(r.keywords).join(", ");

  $("#resourceOrder").value =
    r.order ?? "";

  $("#resourceDescription").value =
    r.description || "";

  $("#resourceForm")
    .classList.remove("hidden");

  openTab("resources");
}


/* =========================================================
   EDIT FOUNDATION
========================================================= */

function editFoundation(id) {

  if (!can("content_admin")) {
    alert("ليس لديك صلاحية.");
    return;
  }

  editing = id;

  const r =
    foundations.find(
      (x) => x.id === id
    );

  if (!r) return;

  $("#foundationTitle").value =
    r.title || "";

  $("#foundationUrl").value =
    r.url || "";

  $("#foundationBranch").value =
    arr(r.branchIds)[0] ||
    "";

  $("#foundationSubject").innerHTML =
    '<option value="">اختر المادة</option>' +
    subjectOptions(
      $("#foundationBranch").value
    );

  $("#foundationSubject").value =
    r.subjectId || "";

  $("#foundationLevel").value =
    r.level ||
    "beginner";

  $("#foundationType").value =
    r.type ||
    "lesson";

  $("#foundationKeywords").value =
    arr(r.keywords).join(", ");

  $("#foundationOrder").value =
    r.order ?? "";

  $("#foundationDescription").value =
    r.description || "";

  $("#foundationForm")
    .classList.remove("hidden");

  openTab("foundations");
}


/* =========================================================
   JSON PARSER
========================================================= */

function parseJSON(
  id,
  messageId
) {

  try {

    const value =
      JSON.parse(
        $(id).value
      );

    return value;

  } catch {

    msg(
      $(messageId),
      "JSON غير صالح.",
      true
    );

    return null;
  }
}


/* =========================================================
   LOGIN
========================================================= */

$("#loginBtn").onclick =
  async () => {

    try {

      await signInWithEmailAndPassword(
        auth,
        $("#email").value.trim(),
        $("#password").value
      );

    } catch {

      msg(
        $("#loginMsg"),
        "فشل تسجيل الدخول أو الحساب ليس ضمن admins.",
        true
      );

    }

  };


$("#password").onkeydown =
  (e) => {

    if (e.key === "Enter") {
      $("#loginBtn").click();
    }

  };


$("#logoutBtn").onclick =
  () => signOut(auth);


/* =========================================================
   BRANCH -> SUBJECT
========================================================= */

$("#resourceBranch").onchange =
  () => {

    $("#resourceSubject").innerHTML =
      '<option value="">اختر المادة</option>' +
      subjectOptions(
        $("#resourceBranch").value
      );

  };


$("#foundationBranch").onchange =
  () => {

    $("#foundationSubject").innerHTML =
      '<option value="">اختر المادة</option>' +
      subjectOptions(
        $("#foundationBranch").value
      );

  };


/* =========================================================
   SUBJECT FORM
========================================================= */

$("#subjectForm").onsubmit =
  async (e) => {

    e.preventDefault();

    if (!can("content_admin")) {
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
            (x) => x.value
          ),

      description:
        $("#subjectDescription")
          .value
          .trim(),

      order:
        Number(
          $("#subjectOrder").value
        ) || 9999,

      updatedAt:
        serverTimestamp()

    };


    if (!data.branchIds.length) {

      return msg(
        $("#subjectMsg"),
        "اختر فرعًا واحدًا على الأقل.",
        true
      );

    }


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
          createdAt:
            serverTimestamp()
        }
      );

    }


    editing = null;

    $("#subjectForm")
      .classList.add("hidden");

    await refresh();

  };


/* =========================================================
   RESOURCE FORM
========================================================= */

$("#resourceForm").onsubmit =
  async (e) => {

    e.preventDefault();

    if (!can("content_admin")) {

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


    try {

      new URL(url);

    } catch {

      return msg(
        $("#resourceMsg"),
        "الرابط غير صالح.",
        true
      );

    }


    /*
      التكرار هنا يعتمد على الرابط فقط.
      لا نهتم بالعنوان أو المادة أو النوع.
    */

    const duplicate =
      resources.some(
        (r) =>
          r.url === url &&
          r.id !== editing
      );


    if (duplicate) {

      return msg(
        $("#resourceMsg"),
        "هذا الرابط موجود بالفعل.",
        true
      );

    }


    const data = {

      title:
        $("#resourceTitle")
          .value
          .trim(),

      url,

      branchId:
        $("#resourceBranch").value,

      subjectId:
        $("#resourceSubject").value,

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
            (x) => x.trim()
          )
          .filter(Boolean),

      order:
        Number(
          $("#resourceOrder").value
        ) || 9999,

      description:
        $("#resourceDescription")
          .value
          .trim(),

      updatedAt:
        serverTimestamp()

    };


    if (!data.branchId) {

      return msg(
        $("#resourceMsg"),
        "اختر الفرع.",
        true
      );

    }


    if (!data.subjectId) {

      return msg(
        $("#resourceMsg"),
        "اختر المادة.",
        true
      );

    }


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
      .classList.add("hidden");

    await refresh();

  };


/* =========================================================
   FOUNDATION FORM
========================================================= */

$("#foundationForm").onsubmit =
  async (e) => {

    e.preventDefault();

    if (!can("content_admin")) {

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


    try {

      new URL(url);

    } catch {

      return msg(
        $("#foundationMsg"),
        "الرابط غير صالح.",
        true
      );

    }


    const duplicate =
      foundations.some(
        (r) =>
          r.url === url &&
          r.id !== editing
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
            (x) => x.trim()
          )
          .filter(Boolean),

      order:
        Number(
          $("#foundationOrder").value
        ) || 9999,

      description:
        $("#foundationDescription")
          .value
          .trim(),

      updatedAt:
        serverTimestamp()

    };


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
      .classList.add("hidden");

    await refresh();

  };


/* =========================================================
   URL DUPLICATE SYSTEM
========================================================= */

/*
  الرابط هو الهوية الفعلية للمحتوى.

  مثال:

  resources:
  https://site.com/book.pdf

  foundations:
  https://site.com/book.pdf

  النتيجة:
  الرابط مكرر.

  لا يتم الاعتماد على:
  - العنوان
  - المادة
  - الفرع
  - النوع
  - التصنيف
  - الكلمات المفتاحية
*/


function normalizeURL(value) {

  return String(value ?? "")
    .trim();

}


function getExistingURLs() {

  const set =
    new Set();

  resources.forEach(
    (item) => {

      const url =
        normalizeURL(
          item.url
        );

      if (url) {
        set.add(url);
      }

    }
  );


  foundations.forEach(
    (item) => {

      const url =
        normalizeURL(
          item.url
        );

      if (url) {
        set.add(url);
      }

    }
  );


  return set;
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

  if (!can("content_admin")) {

    return msg(
      $(messageSelector),
      "ليس لديك صلاحية للاستيراد الجماعي.",
      true
    );

  }


  const list =
    parseJSON(
      textSelector,
      messageSelector
    );


  if (!Array.isArray(list)) {

    return msg(
      $(messageSelector),
      "يجب أن يكون JSON عبارة عن Array.",
      true
    );

  }


  if (!list.length) {

    return msg(
      $(messageSelector),
      "ملف JSON فارغ.",
      true
    );

  }


  /*
    كل الروابط الموجودة حاليًا في الموقع.
    المصدر + التأسيس.
  */

  const existingURLs =
    getExistingURLs();


  /*
    روابط تمت إضافتها أثناء
    معالجة نفس ملف JSON.
  */

  const batchURLs =
    new Set();


  /*
    العناصر التي ستدخل Firestore.
  */

  const validItems = [];


  let duplicate = 0;
  let invalid = 0;


  for (const item of list) {

    const url =
      normalizeURL(
        item?.url
      );


    /* =========================
       الرابط إجباري
    ========================= */

    if (!url) {

      invalid++;
      continue;

    }


    /* =========================
       تحقق URL
    ========================= */

    try {

      new URL(url);

    } catch {

      invalid++;
      continue;

    }


    /* =========================
       الرابط موجود مسبقًا
    ========================= */

    if (
      existingURLs.has(url)
    ) {

      duplicate++;
      continue;

    }


    /* =========================
       الرابط مكرر داخل JSON
    ========================= */

    if (
      batchURLs.has(url)
    ) {

      duplicate++;
      continue;

    }


    /* =========================
       العنوان
    ========================= */

    if (
      !item.title ||
      !String(item.title).trim()
    ) {

      invalid++;
      continue;

    }


    /* =========================
       المادة
    ========================= */

    if (!item.subjectId) {

      invalid++;
      continue;

    }


    /* =========================
       تجهيز البيانات
    ========================= */

    const data = {
      ...item,

      title:
        String(
          item.title
        ).trim(),

      url,

      branchId:
        item.branchId ||
        arr(item.branchIds)[0] ||
        "",

      branchIds:
        Array.isArray(item.branchIds)
          ? item.branchIds
          : arr(item.branchId),

      subjectId:
        String(
          item.subjectId
        ).trim(),

      keywords:
        Array.isArray(item.keywords)
          ? item.keywords
          : String(
              item.keywords || ""
            )
              .split(",")
              .map(
                (x) => x.trim()
              )
              .filter(Boolean),

      order:
        Number(
          item.order
        ) || 9999,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()

    };


    /*
      التأسيس يحتاج branchIds
      والمصادر أيضًا يستطيع استخدام
      branchId أو branchIds.
    */

    if (
      type === "foundation"
    ) {

      if (
        !data.branchIds.length
      ) {

        invalid++;
        continue;

      }

    } else {

      if (
        !data.branchId
      ) {

        invalid++;
        continue;

      }

    }


    /*
      سجّل الرابط حتى لا يتكرر
      في نفس JSON.
    */

    batchURLs.add(url);

    validItems.push(data);

  }


  /* =======================================================
     لا يوجد شيء للإضافة
  ======================================================= */

  if (!validItems.length) {

    msg(
      $(messageSelector),

      `لم تتم إضافة أي عنصر.
المكرر: ${duplicate}
غير الصالح: ${invalid}`,

      duplicate === 0 &&
      invalid > 0
    );

    return;

  }


  /* =======================================================
     BATCH WRITE
  ======================================================= */

  try {

    const batch =
      writeBatch(db);


    validItems.forEach(
      (data) => {

        const ref =
          doc(
            collection(
              db,
              collectionName
            )
          );

        batch.set(
          ref,
          data
        );

      }
    );


    await batch.commit();


  } catch (error) {

    console.error(
      "Bulk import error:",
      error
    );

    return msg(
      $(messageSelector),
      "حدث خطأ أثناء حفظ البيانات في Firebase.",
      true
    );

  }


  /* =======================================================
     النتيجة
  ======================================================= */

  const added =
    validItems.length;


  msg(
    $(messageSelector),

    `تم فحص ${list.length} عنصر.
تمت إضافة ${added}.
تم تجاهل ${duplicate} مكرر.
تم تجاهل ${invalid} غير صالح.`,

    false
  );


  await refresh();

}


/* =========================================================
   BULK BUTTONS
========================================================= */

$("#importResources").onclick =
  () =>
    importItems(
      "#bulkResources",
      "resources",
      "#bulkResourceMsg",
      "resource"
    );


$("#importFoundations").onclick =
  () =>
    importItems(
      "#bulkFoundations",
      "foundations",
      "#bulkFoundationMsg",
      "foundation"
    );


/* =========================================================
   ADMIN MANAGEMENT
========================================================= */

$("#addAdminBtn")?.addEventListener(
  "click",
  () => {

    if (role !== "superadmin") {
      alert(
        "هذه العملية لـ Super Admin فقط."
      );
      return;
    }

    $("#adminForm")
      .classList.remove("hidden");

  }
);


$("#cancelAdmin")?.addEventListener(
  "click",
  () => {

    $("#adminForm")
      .classList.add("hidden");

  }
);


$("#adminForm")?.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    if (role !== "superadmin") {

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

      await updateDoc(
        doc(
          db,
          "admins",
          uid
        ),
        adminData
      );

    } catch {

      await setDoc(
        doc(
          db,
          "admins",
          uid
        ),
        {
          ...adminData,
          createdAt:
            serverTimestamp()
        }
      );

    }


    $("#adminForm")
      .classList.add("hidden");

    $("#adminUid").value = "";

    await refresh();

  }
);


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      $("#loginSection")
        .classList.remove("hidden");

      $("#dashboard")
        .classList.add("hidden");

      return;

    }


    try {

      role =
        await loadRole(user);


      $("#loginSection")
        .classList.add("hidden");

      $("#dashboard")
        .classList.remove("hidden");


      $("#adminEmail")
        .textContent =
        user.email ||
        user.uid;


      $("#roleBadge")
        .textContent =
        role;


      await refresh();


    } catch (error) {

      console.error(
        "Admin authentication error:",
        error
      );

      await signOut(auth);


      msg(
        $("#loginMsg"),
        "هذا الحساب ليس لديه صلاحية أدمن.",
        true
      );

    }

  }
);