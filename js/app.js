import { db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const $ = selector =>
    document.querySelector(selector);


function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function safeURL(value) {

    try {

        const url = new URL(value);

        if (
            url.protocol === "http:" ||
            url.protocol === "https:"
        ) {
            return url.href;
        }

    } catch {}

    return "#";
}


/* القائمة على الجوال */

const menuBtn = $(".menu-btn");
const nav = document.querySelector("nav");

if (menuBtn && nav) {

    menuBtn.addEventListener("click", () => {

        nav.classList.toggle("open");

    });

}


/* المواد */

async function loadSubjects() {

    const grid = $("#subjectsGrid");

    if (!grid) return;


    try {

        const snapshot =
            await getDocs(
                collection(db, "subjects")
            );


        const subjects =
            snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));


        const params =
            new URLSearchParams(location.search);


        let selectedBranch =
            params.get("branch") || "";


        function render() {

            const filtered =
                subjects.filter(subject => {

                    if (!selectedBranch)
                        return true;


                    return (
                        subject.branchIds || []
                    ).includes(selectedBranch);

                });


            if (!filtered.length) {

                grid.innerHTML = `
                    <div class="empty">
                        لا توجد مواد لهذا الفرع حاليًا.
                    </div>
                `;

                return;
            }


            grid.innerHTML =
                filtered.map((subject, index) => `

                    <a
                        class="subject-card"
                        href="resources.html?subject=${subject.id}"
                    >

                        <small>
                            ${String(index + 1).padStart(2, "0")}
                        </small>

                        <div class="subject-icon">
                            📚
                        </div>

                        <h3>
                            ${escapeHTML(subject.name)}
                        </h3>

                        <p>
                            ${escapeHTML(
                                subject.description ||
                                "مصادر ومراجع دراسية"
                            )}
                        </p>

                    </a>

                `).join("");

        }


        document
            .querySelectorAll("[data-branch]")
            .forEach(button => {

                if (
                    button.dataset.branch ===
                    selectedBranch
                ) {
                    button.classList.add("active");
                }


                button.addEventListener(
                    "click",
                    () => {

                        selectedBranch =
                            button.dataset.branch;


                        document
                            .querySelectorAll(
                                "[data-branch]"
                            )
                            .forEach(
                                b =>
                                b.classList.remove(
                                    "active"
                                )
                            );


                        button.classList.add("active");


                        render();

                    }
                );

            });


        render();

    } catch (error) {

        console.error(error);

        grid.innerHTML = `
            <div class="empty">
                تعذر تحميل المواد.
                تأكد من إعدادات Firebase.
            </div>
        `;

    }

}


/* المصادر */

async function loadResources() {

    const grid =
        $("#resourcesGrid");

    if (!grid) return;


    let resources = [];


    try {

        const snapshot =
            await getDocs(
                collection(db, "resources")
            );


        resources =
            snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));


    } catch (error) {

        console.error(error);

        grid.innerHTML = `
            <div class="empty">
                تعذر تحميل المصادر.
            </div>
        `;

        return;
    }


    const search =
        $("#searchInput");

    const branch =
        $("#branchSelect");


    const subject =
        new URLSearchParams(
            location.search
        ).get("subject");


    function render() {

        const searchText =
            (search?.value || "")
            .trim()
            .toLowerCase();


        const selectedBranch =
            branch?.value || "";


        const filtered =
            resources.filter(resource => {

                const matchesSearch =
                    !searchText ||
                    `${resource.title || ""}
                    ${resource.description || ""}`
                    .toLowerCase()
                    .includes(searchText);


                const matchesBranch =
                    !selectedBranch ||
                    resource.branchId ===
                    selectedBranch;


                const matchesSubject =
                    !subject ||
                    resource.subjectId ===
                    subject;


                return (
                    matchesSearch &&
                    matchesBranch &&
                    matchesSubject
                );

            });


        if (!filtered.length) {

            grid.innerHTML = `
                <div class="empty">
                    لا توجد مصادر حاليًا.
                </div>
            `;

            return;

        }


        grid.innerHTML =
            filtered.map(resource => `

                <a
                    class="resource-card"
                    href="${safeURL(resource.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >

                    <div class="resource-cover">

                        📖

                    </div>

                    <div>

                        <span class="tag">
                            ${escapeHTML(
                                resource.type ||
                                "مصدر"
                            )}
                        </span>

                        <h3>
                            ${escapeHTML(
                                resource.title
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                resource.description ||
                                "فتح المصدر"
                            )}
                        </p>

                    </div>

                    <strong>
                        ↗
                    </strong>

                </a>

            `).join("");

    }


    search?.addEventListener(
        "input",
        render
    );


    branch?.addEventListener(
        "change",
        render
    );


    render();

}


loadSubjects();
loadResources();


if ("serviceWorker" in navigator) {

    navigator.serviceWorker
        .register("sw.js")
        .catch(console.error);

}