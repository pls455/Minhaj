import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* =========================================================
   العناصر
========================================================= */

const loginSection = document.querySelector("#loginSection");
const dashboard = document.querySelector("#dashboard");

const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");

const loginBtn = document.querySelector("#loginBtn");
const loginMsg = document.querySelector("#loginMsg");

const logoutBtn = document.querySelector("#logoutBtn");
const adminEmail = document.querySelector("#adminEmail");

const subjectsList = document.querySelector("#subjectsList");
const resourcesList = document.querySelector("#resourcesList");

const subjectsCount = document.querySelector("#subjectsCount");
const resourcesCount = document.querySelector("#resourcesCount");


/* =========================================================
   الحالة
========================================================= */

let subjects = [];
let resources = [];
let categories = [];

let editingSubjectId = null;
let editingResourceId = null;


/* =========================================================
   أدوات
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function branchName(branch) {

    const names = {

        scientific: "العلمي",
        literary: "الأدبي",
        industrial: "الصناعي"

    };

    return names[branch] || branch || "غير محدد";

}


function resourceTypeName(type) {

    const names = {

        text: "📝 نص",

        link: "🔗 رابط",

        text_link: "📝🔗 نص + رابط"

    };

    return names[type] || "محتوى";

}


function showMessage(element, text, error = false) {

    if (!element) return;

    element.textContent = text;

    element.className =
        error
            ? "message error"
            : "message success";

}


/* =========================================================
   تسجيل الدخول
========================================================= */

loginBtn?.addEventListener(
    "click",
    async () => {

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;


        if (!email || !password) {

            showMessage(
                loginMsg,
                "أدخل البريد الإلكتروني وكلمة المرور.",
                true
            );

            return;

        }


        loginBtn.disabled = true;

        loginBtn.textContent =
            "جاري الدخول...";


        try {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        } catch (error) {

            console.error(error);

            showMessage(
                loginMsg,
                "فشل تسجيل الدخول. تأكد من البيانات.",
                true
            );

        } finally {

            loginBtn.disabled = false;

            loginBtn.textContent =
                "دخول";

        }

    }
);


passwordInput?.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            loginBtn.click();

        }

    }
);


/* =========================================================
   تسجيل الخروج
========================================================= */

logoutBtn?.addEventListener(
    "click",
    async () => {

        await signOut(auth);

    }
);


/* =========================================================
   حالة المستخدم
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (user) {

            loginSection.classList.add("hidden");

            dashboard.classList.remove("hidden");

            adminEmail.textContent =
                user.email;

            await loadAll();

        } else {

            loginSection.classList.remove("hidden");

            dashboard.classList.add("hidden");

        }

    }
);


/* =========================================================
   تحميل كل البيانات
========================================================= */

async function loadAll() {

    await loadSubjects();

    await loadCategories();

    await loadResources();

    updateCounts();

    updateSubjectSelect();

    updateCategorySelect();

}


/* =========================================================
   تحميل المواد
========================================================= */

async function loadSubjects() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "subjects")
            );


        subjects =
            snapshot.docs.map(item => ({

                id: item.id,

                ...item.data()

            }));


        renderSubjects();

    } catch (error) {

        console.error(error);

        subjectsList.innerHTML = `
            <div class="empty">
                تعذر تحميل المواد.
            </div>
        `;

    }

}


/* =========================================================
   تحميل التصنيفات
========================================================= */

async function loadCategories() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "categories")
            );


        categories =
            snapshot.docs.map(item => ({

                id: item.id,

                ...item.data()

            }));


        updateCategorySelect();

    } catch (error) {

        console.error(error);

        categories = [];

        updateCategorySelect();

    }

}


/* =========================================================
   تحميل المصادر
========================================================= */

async function loadResources() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "resources")
            );


        resources =
            snapshot.docs.map(item => ({

                id: item.id,

                ...item.data()

            }));


        renderResources();

    } catch (error) {

        console.error(error);

        resourcesList.innerHTML = `
            <div class="empty">
                تعذر تحميل المحتوى.
            </div>
        `;

    }

}


/* =========================================================
   الإحصائيات
========================================================= */

function updateCounts() {

    subjectsCount.textContent =
        subjects.length;

    resourcesCount.textContent =
        resources.length;

}


/* =========================================================
   المواد
========================================================= */

const addSubjectBtn =
    document.querySelector("#addSubjectBtn");

const subjectForm =
    document.querySelector("#subjectForm");

const subjectName =
    document.querySelector("#subjectName");

const subjectBranch =
    document.querySelector("#subjectBranch");

const subjectDescription =
    document.querySelector("#subjectDescription");

const saveSubjectBtn =
    document.querySelector("#saveSubjectBtn");

const cancelSubjectBtn =
    document.querySelector("#cancelSubjectBtn");

const subjectFormTitle =
    document.querySelector("#subjectFormTitle");

const subjectMsg =
    document.querySelector("#subjectMsg");


addSubjectBtn?.addEventListener(
    "click",
    () => {

        editingSubjectId = null;

        subjectFormTitle.textContent =
            "إضافة مادة";

        subjectName.value = "";

        subjectBranch.value = "";

        subjectDescription.value = "";

        subjectMsg.textContent = "";

        subjectForm.classList.remove("hidden");

        subjectName.focus();

    }
);


cancelSubjectBtn?.addEventListener(
    "click",
    () => {

        subjectForm.classList.add("hidden");

        editingSubjectId = null;

    }
);


saveSubjectBtn?.addEventListener(
    "click",
    saveSubject
);


async function saveSubject() {

    const name =
        subjectName.value.trim();

    const branch =
        subjectBranch.value;

    const description =
        subjectDescription.value.trim();


    if (!name || !branch) {

        showMessage(
            subjectMsg,
            "أدخل اسم المادة والفرع.",
            true
        );

        return;

    }


    saveSubjectBtn.disabled = true;

    saveSubjectBtn.textContent =
        "جاري الحفظ...";


    try {

        const data = {

            name,

            branchIds: [branch],

            description,

            updatedAt:
                serverTimestamp()

        };


        if (editingSubjectId) {

            await updateDoc(
                doc(
                    db,
                    "subjects",
                    editingSubjectId
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


        subjectForm.classList.add("hidden");

        editingSubjectId = null;

        await loadSubjects();

        updateCounts();

        updateSubjectSelect();

    } catch (error) {

        console.error(error);

        showMessage(
            subjectMsg,
            "حدث خطأ أثناء الحفظ.",
            true
        );

    } finally {

        saveSubjectBtn.disabled = false;

        saveSubjectBtn.textContent =
            "حفظ";

    }

}


/* =========================================================
   عرض المواد
========================================================= */

function renderSubjects() {

    if (!subjects.length) {

        subjectsList.innerHTML = `
            <div class="empty">
                لا توجد مواد حتى الآن.
                اضغط "+ إضافة مادة".
            </div>
        `;

        return;

    }


    subjectsList.innerHTML =
        subjects.map(subject => `

            <div class="admin-item">

                <div class="admin-item-icon">
                    📚
                </div>

                <div class="admin-item-content">

                    <h3>
                        ${escapeHTML(subject.name)}
                    </h3>

                    <span>
                        ${branchName(
                            subject.branchIds?.[0]
                        )}
                    </span>

                    <p>
                        ${escapeHTML(
                            subject.description ||
                            "بدون وصف"
                        )}
                    </p>

                </div>

                <div class="admin-actions">

                    <button
                        class="edit-btn"
                        data-id="${subject.id}"
                    >
                        تعديل
                    </button>

                    <button
                        class="delete-btn"
                        data-id="${subject.id}"
                    >
                        حذف
                    </button>

                </div>

            </div>

        `).join("");


    subjectsList
        .querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    editSubject(
                        button.dataset.id
                    )
            );

        });


    subjectsList
        .querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    deleteSubject(
                        button.dataset.id
                    )
            );

        });

}


/* =========================================================
   تعديل مادة
========================================================= */

function editSubject(id) {

    const subject =
        subjects.find(
            item => item.id === id
        );


    if (!subject) return;


    editingSubjectId = id;

    subjectFormTitle.textContent =
        "تعديل المادة";

    subjectName.value =
        subject.name || "";

    subjectBranch.value =
        subject.branchIds?.[0] || "";

    subjectDescription.value =
        subject.description || "";

    subjectMsg.textContent = "";

    subjectForm.classList.remove("hidden");

    subjectForm.scrollIntoView({
        behavior: "smooth"
    });

}


/* =========================================================
   حذف مادة
========================================================= */

async function deleteSubject(id) {

    const subject =
        subjects.find(
            item => item.id === id
        );


    if (!subject) return;


    const confirmed =
        confirm(
            `هل تريد حذف مادة "${subject.name}"؟`
        );


    if (!confirmed) return;


    try {

        await deleteDoc(
            doc(
                db,
                "subjects",
                id
            )
        );


        await loadSubjects();

        updateCounts();

        updateSubjectSelect();

    } catch (error) {

        console.error(error);

        alert(
            "تعذر حذف المادة."
        );

    }

}


/* =========================================================
   المصادر / المحتوى
========================================================= */

const addResourceBtn =
    document.querySelector("#addResourceBtn");

const resourceForm =
    document.querySelector("#resourceForm");

const resourceTitle =
    document.querySelector("#resourceTitle");

const resourceBranch =
    document.querySelector("#resourceBranch");

const resourceSubject =
    document.querySelector("#resourceSubject");

const resourceCategory =
    document.querySelector("#resourceCategory");

const resourceType =
    document.querySelector("#resourceType");

const resourceText =
    document.querySelector("#resourceText");

const resourceUrl =
    document.querySelector("#resourceUrl");

const resourceDescription =
    document.querySelector("#resourceDescription");

const resourceTextGroup =
    document.querySelector("#resourceTextGroup");

const resourceUrlGroup =
    document.querySelector("#resourceUrlGroup");

const saveResourceBtn =
    document.querySelector("#saveResourceBtn");

const cancelResourceBtn =
    document.querySelector("#cancelResourceBtn");

const resourceFormTitle =
    document.querySelector("#resourceFormTitle");

const resourceMsg =
    document.querySelector("#resourceMsg");


/* =========================================================
   فتح نموذج الإضافة
========================================================= */

addResourceBtn?.addEventListener(
    "click",
    () => {

        editingResourceId = null;

        resourceFormTitle.textContent =
            "إضافة محتوى";

        resourceTitle.value = "";

        resourceBranch.value = "";

        resourceSubject.value = "";

        resourceCategory.value = "";

        resourceType.value = "";

        resourceText.value = "";

        resourceUrl.value = "";

        resourceDescription.value = "";

        resourceMsg.textContent = "";

        resourceForm.classList.remove("hidden");

        updateSubjectSelect();

        updateCategorySelect();

        updateContentFields();

        resourceTitle.focus();

    }
);


/* =========================================================
   إلغاء
========================================================= */

cancelResourceBtn?.addEventListener(
    "click",
    () => {

        resourceForm.classList.add("hidden");

        editingResourceId = null;

    }
);


/* =========================================================
   تغيير نوع المحتوى
========================================================= */

resourceType?.addEventListener(
    "change",
    updateContentFields
);


function updateContentFields() {

    const type =
        resourceType?.value || "";


    resourceTextGroup?.classList.add("hidden");

    resourceUrlGroup?.classList.add("hidden");


    if (
        type === "text" ||
        type === "text_link"
    ) {

        resourceTextGroup?.classList.remove(
            "hidden"
        );

    }


    if (
        type === "link" ||
        type === "text_link"
    ) {

        resourceUrlGroup?.classList.remove(
            "hidden"
        );

    }

}


/* =========================================================
   تغيير الفرع
========================================================= */

resourceBranch?.addEventListener(
    "change",
    () => {

        updateSubjectSelect();

    }
);


/* =========================================================
   المواد حسب الفرع
========================================================= */

function updateSubjectSelect() {

    if (!resourceSubject)
        return;


    const selectedBranch =
        resourceBranch?.value || "";


    const filtered =
        subjects.filter(subject => {

            if (!selectedBranch)
                return true;

            return (
                subject.branchIds || []
            ).includes(selectedBranch);

        });


    const currentValue =
        resourceSubject.value;


    resourceSubject.innerHTML = `

        <option value="">
            اختر المادة
        </option>

        ${
            filtered.map(subject => `

                <option value="${subject.id}">
                    ${escapeHTML(subject.name)}
                </option>

            `).join("")
        }

    `;


    if (
        filtered.some(
            subject =>
                subject.id === currentValue
        )
    ) {

        resourceSubject.value =
            currentValue;

    }

}


/* =========================================================
   التصنيفات
========================================================= */

function updateCategorySelect() {

    if (!resourceCategory)
        return;


    const currentValue =
        resourceCategory.value;


    resourceCategory.innerHTML = `

        <option value="">
            اختر التصنيف
        </option>

        ${
            categories.map(category => `

                <option value="${category.id}">
                    ${escapeHTML(
                        category.name ||
                        category.title ||
                        "تصنيف"
                    )}
                </option>

            `).join("")
        }

    `;


    if (
        categories.some(
            category =>
                category.id === currentValue
        )
    ) {

        resourceCategory.value =
            currentValue;

    }

}


/* =========================================================
   حفظ المحتوى
========================================================= */

saveResourceBtn?.addEventListener(
    "click",
    saveResource
);


async function saveResource() {

    const title =
        resourceTitle.value.trim();

    const branch =
        resourceBranch.value;

    const subjectId =
        resourceSubject.value;

    const categoryId =
        resourceCategory.value;

    const type =
        resourceType.value;

    const text =
        resourceText.value.trim();

    const url =
        resourceUrl.value.trim();

    const description =
        resourceDescription.value.trim();


    /* التحقق الأساسي */

    if (
        !title ||
        !branch ||
        !subjectId ||
        !type
    ) {

        showMessage(
            resourceMsg,
            "أكمل العنوان والفرع والمادة ونوع المحتوى.",
            true
        );

        return;

    }


    /* التحقق من النص */

    if (
        (type === "text" ||
         type === "text_link") &&
        !text
    ) {

        showMessage(
            resourceMsg,
            "اكتب المحتوى النصي.",
            true
        );

        return;

    }


    /* التحقق من الرابط */

    if (
        (type === "link" ||
         type === "text_link") &&
        !url
    ) {

        showMessage(
            resourceMsg,
            "أدخل الرابط.",
            true
        );

        return;

    }


    if (
        type === "link" ||
        type === "text_link"
    ) {

        try {

            new URL(url);

        } catch {

            showMessage(
                resourceMsg,
                "الرابط غير صحيح. مثال: https://example.com",
                true
            );

            return;

        }

    }


    saveResourceBtn.disabled = true;

    saveResourceBtn.textContent =
        "جاري الحفظ...";


    try {

        const data = {

            title,

            type,

            branchId: branch,

            subjectId,

            categoryId: categoryId || "",

            content: text || "",

            url: url || "",

            description,

            updatedAt:
                serverTimestamp()

        };


        if (editingResourceId) {

            await updateDoc(
                doc(
                    db,
                    "resources",
                    editingResourceId
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


        resourceForm.classList.add("hidden");

        editingResourceId = null;

        await loadResources();

        updateCounts();


        showMessage(
            resourceMsg,
            "تم حفظ المحتوى بنجاح."
        );

    } catch (error) {

        console.error(error);

        showMessage(
            resourceMsg,
            "حدث خطأ أثناء حفظ المحتوى.",
            true
        );

    } finally {

        saveResourceBtn.disabled = false;

        saveResourceBtn.textContent =
            "حفظ المحتوى";

    }

}


/* =========================================================
   عرض المحتوى
========================================================= */

function renderResources() {

    if (!resources.length) {

        resourcesList.innerHTML = `
            <div class="empty">
                لا يوجد محتوى حتى الآن.
                اضغط "+ إضافة محتوى".
            </div>
        `;

        return;

    }


    resourcesList.innerHTML =
        resources.map(resource => {

            const subject =
                subjects.find(
                    item =>
                        item.id ===
                        resource.subjectId
                );


            const category =
                categories.find(
                    item =>
                        item.id ===
                        resource.categoryId
                );


            return `

                <div class="admin-item">

                    <div class="admin-item-icon">
                        ${resource.type === "text"
                            ? "📝"
                            : resource.type === "link"
                                ? "🔗"
                                : "📝🔗"}
                    </div>

                    <div class="admin-item-content">

                        <h3>
                            ${escapeHTML(
                                resource.title
                            )}
                        </h3>

                        <span>

                            ${branchName(
                                resource.branchId
                            )}

                            •

                            ${escapeHTML(
                                subject?.name ||
                                "مادة غير معروفة"
                            )}

                            ${
                                category
                                ? ` • ${escapeHTML(
                                    category.name ||
                                    category.title ||
                                    "تصنيف"
                                )}`
                                : ""
                            }

                        </span>

                        <p>

                            ${resourceTypeName(
                                resource.type
                            )}

                            ${
                                resource.description
                                ? ` · ${escapeHTML(
                                    resource.description
                                )}`
                                : ""
                            }

                        </p>

                    </div>

                    <div class="admin-actions">

                        ${
                            resource.url
                            ? `
                                <a
                                    class="open-btn"
                                    href="${escapeHTML(
                                        resource.url
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    فتح الرابط
                                </a>
                            `
                            : ""
                        }

                        <button
                            class="edit-resource-btn"
                            data-id="${resource.id}"
                        >
                            تعديل
                        </button>

                        <button
                            class="delete-resource-btn"
                            data-id="${resource.id}"
                        >
                            حذف
                        </button>

                    </div>

                </div>

            `;

        }).join("");


    resourcesList
        .querySelectorAll(
            ".edit-resource-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    editResource(
                        button.dataset.id
                    )
            );

        });


    resourcesList
        .querySelectorAll(
            ".delete-resource-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    deleteResource(
                        button.dataset.id
                    )
            );

        });

}


/* =========================================================
   تعديل المحتوى
========================================================= */

function editResource(id) {

    const resource =
        resources.find(
            item => item.id === id
        );


    if (!resource) return;


    editingResourceId = id;

    resourceFormTitle.textContent =
        "تعديل المحتوى";


    resourceTitle.value =
        resource.title || "";


    resourceBranch.value =
        resource.branchId || "";


    updateSubjectSelect();


    resourceSubject.value =
        resource.subjectId || "";


    updateCategorySelect();


    resourceCategory.value =
        resource.categoryId || "";


    resourceType.value =
        resource.type || "";


    resourceText.value =
        resource.content || "";


    resourceUrl.value =
        resource.url || "";


    resourceDescription.value =
        resource.description || "";


    resourceMsg.textContent = "";


    updateContentFields();


    resourceForm.classList.remove(
        "hidden"
    );


    resourceForm.scrollIntoView({
        behavior: "smooth"
    });

}


/* =========================================================
   حذف المحتوى
========================================================= */

async function deleteResource(id) {

    const resource =
        resources.find(
            item => item.id === id
        );


    if (!resource) return;


    const confirmed =
        confirm(
            `هل تريد حذف "${resource.title}"؟`
        );


    if (!confirmed) return;


    try {

        await deleteDoc(
            doc(
                db,
                "resources",
                id
            )
        );


        await loadResources();

        updateCounts();

    } catch (error) {

        console.error(error);

        alert(
            "تعذر حذف المحتوى."
        );

    }

}


/* =========================================================
   تبويبات الأدمن
========================================================= */

document
    .querySelectorAll(".admin-tab")
    .forEach(tab => {

        tab.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".admin-tab")
                    .forEach(item =>
                        item.classList.remove(
                            "active"
                        )
                    );


                tab.classList.add("active");


                const selected =
                    tab.dataset.tab;


                document
                    .querySelector("#subjectsPanel")
                    .classList.toggle(
                        "hidden",
                        selected !== "subjects"
                    );


                document
                    .querySelector("#resourcesPanel")
                    .classList.toggle(
                        "hidden",
                        selected !== "resources"
                    );

            }
        );

    });