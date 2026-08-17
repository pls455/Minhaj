const CACHE_NAME = "minhaj-v1";

const FILES = [
    "./",
    "./index.html",
    "./subjects.html",
    "./resources.html",
    "./about.html",
    "./admin.html",
    "./css/style.css",
    "./js/firebase.js",
    "./js/app.js",
    "./js/admin.js",
    "./manifest.json",
    "./assets/logo.svg"
];


self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(cache =>
                    cache.addAll(FILES)
                )

        );

    }
);


self.addEventListener(
    "fetch",
    event => {

        event.respondWith(

            caches
                .match(event.request)
                .then(cached => {

                    return (
                        cached ||
                        fetch(event.request)
                    );

                })

        );

    }
);