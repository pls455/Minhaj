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

function branchesHTML(ids = []) {

  return arr(ids)
    .map(
      (id) =>
        branches[id] || id
    )
    .join("، ") ||
    "غير محدد";
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
  if (!user?.uid) throw new Error("NO_USER");
  const snap = await getDoc(doc(db, "admins", user.uid));
  if (!snap.exists()) { const e=new Error("NO_ADMIN"); e.code="NO_ADMIN"; throw e; }
  const data=snap.data()||{};
  if (data.active === false) { const e=new Error("ADMIN_DISABLED"); e.code="ADMIN_DISABLED"; throw e; }
  const raw=String(data.role||"reviewer").trim().toLowerCase();
  const aliases={admin:"superadmin",super_admin:"superadmin",superadmin:"superadmin",contentadmin:"content_admin",content_admin:"content_admin",reviewer:"reviewer"};
  return aliases[raw]||"reviewer";
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


/* =========================================================
   REFRESH DATA
========================================================= */

async function refresh() {

  try {

    const [
      subjectsResult,
      resourcesResult,
      foundationsResult,
      suggestionsResult
    ] =
      await Promise.all([

        all("subjects"),

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


    subjects =
      subjectsResult;

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
                    branches[
                      resource.branchId
                    ] ||
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
    resource.category ||
    resource.categoryId ||
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
  const loginBtn=$("#loginBtn");
  loginBtn.onclick=async()=>{
    const email=$("#email")?.value.trim()||"";
    const password=$("#password")?.value||"";
    const loginMsg=$("#loginMsg");
    if(!email||!password){msg(loginMsg,"أدخل البريد الإلكتروني وكلمة المرور.",true);return;}
    loginBtn.disabled=true; loginBtn.textContent="جاري تسجيل الدخول...";
    msg(loginMsg,"جارٍ التحقق من الحساب...",false);
    try{
      await signInWithEmailAndPassword(auth,email,password);
      msg(loginMsg,"تم تسجيل الدخول، جارٍ تحميل لوحة الإدارة...",false);
    }catch(error){
      console.error("Login error:",error);
      const m={"auth/invalid-credential":"البريد الإلكتروني أو كلمة المرور غير صحيحة.","auth/invalid-email":"صيغة البريد الإلكتروني غير صحيحة.","auth/user-disabled":"هذا الحساب معطل في Firebase Authentication.","auth/too-many-requests":"تمت محاولات كثيرة. حاول لاحقًا.","auth/network-request-failed":"تعذر الاتصال بـ Firebase. تحقق من الإنترنت.","auth/operation-not-allowed":"تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase Authentication."};
      msg(loginMsg,m[error?.code]||`فشل تسجيل الدخول: ${error?.message||error?.code||"خطأ غير معروف"}`,true);
    }finally{loginBtn.disabled=false;loginBtn.textContent="دخول";}
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
        $("#resourceBranch")
          .value;


      const subjectId =
        $("#resourceSubject")
          .value;


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


    const subjectId =
      String(
        item.subjectId ?? ""
      ).trim();


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
          .map(
            (branch) =>
              String(
                branch
              ).trim()
          )
          .filter(Boolean);

    }


    if (
      !branchIds.length &&
      item.branchId
    ) {

      branchIds = [
        String(
          item.branchId
        ).trim()
      ];

    }


    const branchId =
      String(
        item.branchId ||
        branchIds[0] ||
        ""
      ).trim();


    if (
      type === "resource" &&
      !branchId
    ) {

      invalid++;

      errors.push(
        `العنصر ${number}: لا يوجد branchId`
      );

      continue;
    }


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

      data.category =
        String(
          item.category ||
          ""
        ).trim();

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

onAuthStateChanged(auth, async (user) => {
  const loginSection=$("#loginSection"), dashboard=$("#dashboard"), loginMsg=$("#loginMsg");
  if(!user){ role=null; loginSection?.classList.remove("hidden"); dashboard?.classList.add("hidden"); return; }
  try{
    msg(loginMsg,"تم التحقق من الحساب، جارٍ تحميل الصلاحيات...",false);
    role=await loadRole(user);
    loginSection?.classList.add("hidden"); dashboard?.classList.remove("hidden");
    if($("#adminEmail")) $("#adminEmail").textContent=user.email||user.uid;
    if($("#roleBadge")) $("#roleBadge").textContent=role;
    await refresh();
  }catch(error){
    console.error("Admin authentication error:",error); role=null;
    loginSection?.classList.remove("hidden"); dashboard?.classList.add("hidden");
    const code=error?.code||error?.message||"";
    let text="تعذر تحميل صلاحيات لوحة الإدارة.";
    if(code==="NO_ADMIN") text="تم تسجيل الدخول، لكن لا توجد وثيقة أدمن لهذا الحساب في Firestore.";
    else if(code==="ADMIN_DISABLED") text="تم تسجيل الدخول، لكن حساب الأدمن معطل.";
    else if(String(code).includes("permission-denied")) text="تم تسجيل الدخول، لكن Firestore رفض قراءة صلاحيات الأدمن. راجع Firestore Rules.";
    else text+=` (${code})`;
    msg(loginMsg,text,true);
  }
});
