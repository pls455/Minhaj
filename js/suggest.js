import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* =========================================================
   HELPERS
========================================================= */

const $ = (s) => document.querySelector(s);

const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");


const form = $("#suggestForm");
const type = $("#contentType");
const branch = $("#branch");
const subject = $("#subject");
const foundationFields = $("#foundationFields");
const msg = $("#suggestMsg");

const suggestLoading = $("#suggestLoading");
const suggestLoadingText = $("#suggestLoadingText");

let branches = [];

async function loadBranches() {
  try {
    const snap = await getDocs(collection(db, "branches"));
    branches = snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(x => x.active !== false).sort((a,b)=>(a.order??9999)-(b.order??9999));
    if (branch) branch.innerHTML = `<option value="">اختر الفرع</option>` + branches.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
  } catch (e) { console.error("Load branches error:", e); }
}


/* =========================================================
   MESSAGE
========================================================= */

function setMsg(text, error = false) {

  if (!msg) return;

  msg.textContent = text;

  msg.className =
    error
      ? "message error"
      : "message success";
}


/* =========================================================
   LOADING
========================================================= */

function showSuggestLoading(
  text = "لحظات ونرسل المحتوى للمراجعة..."
) {

  if (!suggestLoading) return;

  if (suggestLoadingText) {
    suggestLoadingText.textContent = text;
  }

  suggestLoading.classList.remove("hidden");

  document.body.classList.add(
    "suggest-loading-active"
  );
}


function hideSuggestLoading() {

  if (!suggestLoading) return;

  suggestLoading.classList.add("hidden");

  document.body.classList.remove(
    "suggest-loading-active"
  );
}


/* =========================================================
   LOAD SUBJECTS
========================================================= */

async function loadSubjects() {

  if (!branch.value) {

    subject.innerHTML =
      '<option value="">اختر المادة</option>';

    return;
  }

  subject.innerHTML =
    '<option value="">جاري تحميل المواد...</option>';

  try {

    const snap =
      await getDocs(
        query(
          collection(db, "subjects"),
          where(
            "branchIds",
            "array-contains",
            branch.value
          )
        )
      );

    subject.innerHTML =
      '<option value="">اختر المادة</option>' +

      snap.docs

        .map(
          (d) => `
            <option value="${esc(d.id)}">
              ${esc(d.data().name)}
            </option>
          `
        )

        .join("");

  } catch (error) {

    console.error(
      "Load subjects error:",
      error
    );

    subject.innerHTML =
      '<option value="">تعذر تحميل المواد</option>';
  }
}


loadBranches().then(loadSubjects);

/* =========================================================
   CONTENT TYPE
========================================================= */

type.onchange = () => {

  foundationFields.classList.toggle(
    "hidden",
    type.value !== "foundation"
  );

};


/* =========================================================
   BRANCH
========================================================= */

branch.onchange =
  loadSubjects;


/* =========================================================
   FORM SUBMIT
========================================================= */

form.onsubmit = async (e) => {

  e.preventDefault();


  /* -------------------------------------------------------
     Prevent duplicate clicks
  ------------------------------------------------------- */

  const submitButton =
    form.querySelector(
      'button[type="submit"]'
    );

  if (
    submitButton?.disabled
  ) {

    return;
  }


  const url =
    $("#url")
      .value
      .trim();


  /* -------------------------------------------------------
     URL VALIDATION
  ------------------------------------------------------- */

  try {

    new URL(url);

  } catch {

    return setMsg(
      "الرابط غير صالح.",
      true
    );

  }


  /* -------------------------------------------------------
     BASIC VALIDATION
  ------------------------------------------------------- */

  if (
    !branch.value ||
    !subject.value
  ) {

    return setMsg(
      "اختر الفرع والمادة.",
      true
    );

  }


  /* -------------------------------------------------------
     START LOADING
  ------------------------------------------------------- */

  if (submitButton) {

    submitButton.disabled = true;

    submitButton.dataset.originalText =
      submitButton.textContent;

    submitButton.textContent =
      "جاري الإرسال...";
  }


  showSuggestLoading(
    "جاري فحص الرابط والمحتوى..."
  );


  try {

    /* =====================================================
       CHECK PENDING SUGGESTIONS
    ===================================================== */

    const col =
      collection(
        db,
        "suggestions"
      );


    const existing =
      await getDocs(
        query(
          col,
          where(
            "url",
            "==",
            url
          ),
          where(
            "status",
            "==",
            "pending"
          )
        )
      );


    if (!existing.empty) {

      hideSuggestLoading();

      return setMsg(
        "هذا الرابط موجود أصلًا ضمن اقتراحات قيد المراجعة.",
        true
      );

    }


    /* =====================================================
       CHECK EXISTING RESOURCES
    ===================================================== */

    showSuggestLoading(
      "جاري التأكد من أن الرابط غير موجود مسبقًا..."
    );


    const all =
      await getDocs(
        query(
          collection(
            db,
            "resources"
          ),
          where(
            "url",
            "==",
            url
          )
        )
      );


    const found =
      all.docs.length > 0;


    /* =====================================================
       CHECK EXISTING FOUNDATIONS
    ===================================================== */

    const f =
      await getDocs(
        query(
          collection(
            db,
            "foundations"
          ),
          where(
            "url",
            "==",
            url
          )
        )
      );


    if (
      found ||
      !f.empty
    ) {

      hideSuggestLoading();

      return setMsg(
        "هذا الرابط موجود بالفعل في منهاج.",
        true
      );

    }


    /* =====================================================
       PREPARE DATA
    ===================================================== */

    showSuggestLoading(
      "جاري إرسال اقتراحك للمراجعة..."
    );


    const data = {

      contentType:
        type.value,

      title:
        $("#title")
          .value
          .trim(),

      url,

      branchIds: [
        branch.value
      ],

      branchId:
        branch.value,

      subjectId:
        subject.value,

      level:
        type.value === "foundation"
          ? $("#level").value
          : null,

      type:
        type.value === "foundation"
          ? $("#foundationType").value
          : $("#type").value.trim(),

      category:
        type.value === "resource"
          ? $("#type").value.trim()
          : "تأسيس",

      description:
        $("#description")
          .value
          .trim(),

      keywords:
        $("#keywords")
          .value
          .split(",")
          .map(
            (x) => x.trim()
          )
          .filter(Boolean),

      studentName:
        $("#studentName")
          .value
          .trim(),

      status:
        "pending",

      createdAt:
        serverTimestamp()

    };


    /* =====================================================
       SAVE TO FIRESTORE
    ===================================================== */

    await addDoc(
      col,
      data
    );


    /* =====================================================
       SUCCESS
    ===================================================== */

    showSuggestLoading(
      "تم إرسال الاقتراح بنجاح..."
    );


    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          700
        )
    );


    form.reset();

    foundationFields.classList.add(
      "hidden"
    );


    subject.innerHTML =
      '<option value="">اختر المادة</option>';


    hideSuggestLoading();


    setMsg(
      "تم إرسال اقتراحك. سيتم مراجعته قبل ظهوره في الموقع."
    );


  } catch (error) {

    console.error(
      "Suggestion submit error:",
      error
    );


    hideSuggestLoading();


    setMsg(
      "حدث خطأ أثناء إرسال الاقتراح. حاول مرة أخرى.",
      true
    );


  } finally {

    if (submitButton) {

      submitButton.disabled = false;

      submitButton.textContent =
        submitButton.dataset.originalText ||
        "إرسال للمراجعة";

    }

  }

};