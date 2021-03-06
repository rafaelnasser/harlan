"use strict";

import babelify from "babelify";
import browserify from "browserify";
import browserSync from "browser-sync";
import buffer from "vinyl-buffer";
import crypto from "crypto";
import fs from "fs";
import glob from "glob";
import gulp from "gulp";
import gulpLoadPlugins from "gulp-load-plugins";
import merge from "merge-stream";
import path from "path";
import persistify from "persistify";
import runSequence from "run-sequence";
import source from "vinyl-source-stream";
import stylish from "jshint-stylish";

const $ = gulpLoadPlugins(),
reload = browserSync.reload,
dist = "Server/web",
src = "src",
plugins = `${src}/plugins`,
vendors = "bower_components",
externalJsSources = [
    `${vendors}/twin-bcrypt/twin-bcrypt.min.js`,
    `${vendors}/sql.js/js/sql.js`,
    `${vendors}/react/react.js`,
    `${vendors}/react/react-dom.js`,
    `${vendors}/jquery/dist/jquery.js`,
    `${vendors}/jquery/dist/jquery.js`,
    `${vendors}/jquery.bipbop/dist/jquery.bipbop.js`,
    `${vendors}/jquery.payment/lib/jquery.payment.js`,
    `${vendors}/jquery-mask-plugin/src/jquery.mask.js`,
    `${vendors}/oauth.io/dist/oauth.min.js`,
    `${vendors}/zeroclipboard/dist/ZeroClipboard.js`,
    `${vendors}/toastr/toastr.js`,
    `${vendors}/mustache/mustache.js`,
    `${vendors}/moment/min/moment-with-locales.js`,
    `${vendors}/numeral/numeral.js`,
    `${vendors}/numeral/languages.js`,
    `${vendors}/material-design-lite/material.js`,
    `${vendors}/pikaday/pikaday.js`,
    `${vendors}/pikaday/plugins/pikaday.jquery.js`
],
PRODUCTION = typeof $.util.env.production !== "undefined" ? true : false,
DEVEL = !PRODUCTION,
PREPROCESSOR_CONTEXT = {
    context: {
        CONTEXT: PRODUCTION ? "PRODUCTION" : "DEVELOPMENT"
    }
};

function i18n(locale) {
    return gulp.src("src/js/internals/i18n/" + locale + "/**/*.json")
    .pipe($.messageformat({
        locale: locale,
        module: "commonJS"
    }))
    .pipe(gulp.dest("src/js/internals/i18n"))
    .pipe($.size({title: `>>> i18n-${locale}`}));
}

gulp.task("swf", () => {
    return gulp.src([
        "bower_components/zeroclipboard/dist/ZeroClipboard.swf"
    ])
    .pipe(gulp.dest(`${dist}/assets`))
    .pipe($.size({title: ">>> swf"}));
});

gulp.task("legal", () => {
    return gulp.src([
        "legal/**/*.pdf"
    ])
    .pipe(gulp.dest(`${dist}/legal`))
    .pipe($.size({title: ">>> legal"}));
});

gulp.task("manifest", () => {
    return gulp.src([
        "manifest*.json",
        "CNAME",
        `${src}/robots.txt`
    ])
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> manifest"}));
});

gulp.task("templates", () => {
    return gulp.src(`${src}/templates/**/*.tpl`)
    .pipe(gulp.dest(`${dist}/templates`))
    .pipe($.size({title: ">>> templates"}));
});

gulp.task("html", () => {
    return gulp.src(`${src}/**/*.html`)
    .pipe($.fileInclude({
        prefix: "@@",
        basepath: "@file"
    }))
    .pipe($.hashSrc({
        build_dir: dist,
        src_path: src
    }))
    .pipe($.htmlhint())
    .pipe($.htmlhint.reporter())
    .pipe($.htmlMinifier({
        collapseWhitespace: true,
        removeComments: true
    }))
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> html"}));
});

gulp.task("i18n-en", () => {
    i18n("en");
});

gulp.task("i18n-pt", () => {
    i18n("pt");
});

gulp.task("i18n", ["i18n-en", "i18n-pt"]);

gulp.task("build:plugins:template", () => {
    return gulp.src(`${plugins}/templates/**/*.html`)
    .pipe($.htmlMinifier({
        collapseWhitespace: true,
        removeComments: true
    }))
    .pipe($.htmlToJs())
    .pipe(gulp.dest(`${plugins}/templates`))
    .pipe($.size({title: ">>> build:plugins:template"}));
});

gulp.task("build:plugins:markdown", () => {
    return gulp.src(`${plugins}/markdown/**/*.md`)
    .pipe($.markdown())
    .pipe($.htmlMinifier({
        collapseWhitespace: true,
        removeComments: true
    }))
    .pipe($.htmlToJs())
    .pipe(gulp.dest(`${plugins}/markdown`))
    .pipe($.size({title: ">>> build:plugins:markdown"}));
});

gulp.task("build:plugins:sql", () => {
    return gulp.src(`${plugins}/sql/**/*.sql`)
    .pipe($.texttojs({
        template: "module.exports = function (controller) { return controller.database.exec(<%= content %>); };"
    }))
    .pipe(gulp.dest(`${plugins}/sql`))
    .pipe($.size({title: ">>> build:plugins:sql"}));
});

gulp.task("build:plugins:css", () => {
    return gulp.src(`${plugins}/styles/**/*.css`)
    .pipe($.autoprefixer())
    .pipe($.importCss())
    .pipe($.cssnano({
        reduceIdents: false,
        mergeIdents: false
    }))
    .pipe($.css2js())
    .pipe(gulp.dest(`${plugins}/styles/`))
    .pipe($.size({title: ">>> build:plugins:css"}))
    .pipe(reload({stream: true}));
});

gulp.task("build:plugins:sass", () => {
    return gulp.src(`${plugins}/styles/**/*.scss`)
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.importCss())
    .pipe($.cssnano({
        reduceIdents: false,
        mergeIdents: false
    }))
    .pipe($.css2js())
    .pipe(gulp.dest(`${plugins}/styles`))
    .pipe($.size({title: ">>> build:plugins:sass"}))
    .pipe(reload({stream: true}));
});

gulp.task("build:plugins:styles", ["build:plugins:sass", "build:plugins:css"]);

gulp.task("build:plugins", [
    "build:plugins:template",
    "build:plugins:markdown",
    "build:plugins:styles",
    "build:plugins:sql",
], () => {
    let files = glob.sync(`${plugins}/*.js`);

    return merge(files.map((entry) => {
        entry = "./" + entry;
        return browserify({
            entries: entry,
            debug: true
        })
        .transform(babelify, {presets: ["es2015", "react"]})
        .bundle()
        .pipe(source(path.basename(entry)))
        .pipe(buffer())
        .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
        .pipe($.if(PRODUCTION, $.uglify()))
        .pipe($.if(DEVEL, $.sourcemaps.write(".")))
        .pipe(gulp.dest(`${dist}/js`))
        .pipe($.size({title: ">>> build:plugins"}));
    }));
});

gulp.task("deploy", () => {
    return gulp.src(`${dist}/**/*`)
    .pipe($.ghPages())
    .pipe($.size({title: "deploy"}));
});

gulp.task("jshint", () => {
    return gulp.src([
        `${src}/js/**/*.js`,
        `!${src}/js/internals/i18n/**/*`,
        `${plugins}/**/*.js`
    ])
    .pipe($.if(PRODUCTION, $.jshint({esnext: true})))
    .pipe($.if(PRODUCTION, $.jshint.reporter(stylish)))
    .pipe($.size({title: ">>> jshint"}));
});

gulp.task("build:tests", ["jshint"], () => {
    return browserify({
        entries: `${src}/js/tests/index.js`,
        debug: true
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("index.js"))
    .pipe(buffer())
    .pipe($.addSrc(externalJsSources.concat([
        `${vendors}/chai/chai.js`,
        `${vendors}/mocha/mocha.js`
    ])))
    .pipe($.sourcemaps.init({loadMaps: true}))
    .pipe($.concat("index.js"))
    .pipe($.sourcemaps.write("."))
    .pipe(gulp.dest("test/spec"))

});

gulp.task("inflate", () => {
    return browserify({
        entries: `${src}/js/app-inflate.js`,
        debug: true
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("app-inflate.js"))
    .pipe(buffer())
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("app-inflate.js"))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.size({title: ">>> inflate"}));
});

gulp.task("service-worker", () => {
    return browserify({
        entries: `${src}/js/service-worker.js`,
        debug: true
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("service-worker.js"))
    .pipe(buffer())
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("service-worker.js"))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> service-worker"}));
});

gulp.task("build:installer", ["build:application"], () => {
    return browserify({
        entries: `${src}/js/app-installer.js`,
        debug: true
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("app-installer.js"))
    .pipe(buffer())
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("app-installer.js"))
    .pipe($.preprocess({context: {
        COMPRESSED_SIZE: fs.statSync(`${dist}/js/app.js.gz`).size,
        APP_SIZE: fs.statSync(`${dist}/js/app.js`).size,
        MD5: crypto.createHash('md5').update(fs.readFileSync(`${dist}/js/app.js`)).digest("hex")
    }}))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.size({title: ">>> build:installer"}));
});

gulp.task("build:application", ["jshint", "i18n"], () => {
    return browserify({
        entries: `${src}/js/app.js`,
        debug: true
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("app.js"))
    .pipe(buffer())
    .pipe($.preprocess(PREPROCESSOR_CONTEXT))
    .pipe($.addSrc(externalJsSources))
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("app.js"))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.pako.gzip())
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.size({title: ">>> build:application"}));
});

gulp.task("build:images:vector", () => {
    return gulp.src([
        `${src}/**/*.svg`
    ])
    .pipe($.newer(dist))
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> build:images:vector"}));
});

gulp.task("build:images:backgrounds", () => {
    return gulp.src([
        `${src}/images/bg/*.{jpg,jpeg}`
    ])
    .pipe($.newer(`${dist}/images/bg`))
    .pipe($.imageResize({
        width: 4096,
        quality: 0.8,
        format: "jpg"
    }))
    .pipe($.if(PRODUCTION, $.imageOptimization({
        optimizationLevel: 5,
        progressive: true,
        interlaced: true
    })))
    .pipe(gulp.dest(`${dist}/images/bg`))
    .pipe($.size({title: ">>> build:images:backgrounds"}));
});

gulp.task("build:images:no-vector", () => {
    return gulp.src([
        `${src}/**/*.{png, jpg, gif, jpeg}`,
        `!${src}/images/bg/*.{jpg, jpeg}`
    ])
    .pipe($.newer(dist))
    .pipe($.if(PRODUCTION, $.imageOptimization({
        optimizationLevel: 5,
        progressive: true,
        interlaced: true
    })))
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> build:images:no-vector"}));
});

gulp.task("build:images", ["build:images:no-vector", "build:images:vector", "build:images:backgrounds"]);

gulp.task("fonts", () => {
    return gulp.src([
        `${vendors}/font-awesome/fonts/**/*`
    ])
    .pipe(gulp.dest(`${dist}/fonts`))
    .pipe($.size({title: ">>> fonts"}));
});

gulp.task("styles", () => {
    return gulp.src([
        `${src}/scss/screen.scss`
    ])
    .pipe($.compass({
        css: `${dist}/css`,
        sass: `${src}/scss`,
        image: `${dist}/images`
    }))
    .pipe(buffer())
    .pipe($.autoprefixer())
    .pipe($.importCss())
    .pipe($.concat("app.css"))
    .pipe($.cssnano({
        reduceIdents: false,
        mergeIdents: false
    }))
    .pipe(gulp.dest(`${dist}/css`))
    .pipe($.size({title: ">>> styles"}))
    .pipe(reload({stream: true}));
});

gulp.task("default", cb => {
    return runSequence("build", "watch", cb);
});

gulp.task("build", cb => {
    const leaves = [
        "service-worker",
        "manifest",
        "legal",
        "fonts",
        "swf",
        "styles",
        "templates",
        "html",
        "inflate"
    ];

    return runSequence(
        ["build:plugins", "build:installer", "build:tests", "build:images"],
        leaves,
        cb
    );
});

gulp.task("watch", () => {
    browserSync({
        notify: true,
        open: false,
        port: 3000,
        server: {
            baseDir: [dist, src]
        }
    });
    gulp.watch("src/js/internals/i18n/**/*.json", ["i18n", "build:installer", "build:application", reload]);
    gulp.watch(["src/scss/*", "src/scss/*.scss"], ["styles"]);
    gulp.watch(["src/js/service-worker.js"], ["service-worker", reload]);
    gulp.watch([
        "src/js/*.js",
        "src/js/internals/**/*.js",
        "!src/js/service-worker.js",
        "!src/js/app-installer.js",
        "!src/js/app-inflate.js",
        "!src/js/internals/i18n/**/*.js"
    ], ["jshint", "build:application", "build:installer", reload]);
    gulp.watch("src/js/app-inflate.js", ["jshint", "inflate", reload]);
    gulp.watch("src/js/app-installer.js", ["jshint", "build:installer", reload]);
    gulp.watch("src/js/tests/**/*.js", ["jshint", "build:tests", reload]);
    gulp.watch(["src/**/*.html", "src/**/*.tpl"], ["html", "templates", reload]);
    gulp.watch([
        "src/plugins/styles/**/*.{css,scss}",
        "src/plugins/templates/**/*.html",
        "src/plugins/sql/**/*.sql",
        "src/plugins/**/*.js",
        "src/plugins/markdown/**/*.md",
        "!src/plugins/markdown/**/*.js",
        "!src/plugins/templates/**/*.js",
        "!src/plugins/sql/**/*.js",
        "!src/plugins/styles/**/*.js"
    ], ["build:plugins", reload]);
});
