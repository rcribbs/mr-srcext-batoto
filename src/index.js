import "core-js/features/url";

const cheerio = require("cheerio");
const CryptoJS = require("crypto-js");

class ChapterListItem {
    number = "";
    // Number is the chapter number. Could be an actual number like "1" or could
    // be a special chapter like "EX" or "Omake".
    //
    title = "";
    // Name is the short title of the chapter.
    // 
    description = "";
    // Description is the longer description of the chapter. May be blank
    // depending on the way the website handles information about chapters.
    // 
    identifier = "";
    // Identifier is a source-specific identifier. Could be an id like "1234" or
    // anything that makes sense for this source. This identifier will be
    // provided in getChapter call as chapterIdentifier to retrieve the chapter
    // pages.
    // 
    group = null
    // Optional: Scanalation group if one exists.
    // 
    variant = null
    // Optional: Set variant if there are multiple versions of the same chapter
    //           and group is not present or not enough to differintiate.
    //
    created = null;
    // Optional: Date created as a string if it exists.

    created = null;
    // Optional: Date updated as a string if it exists.

    published = null;
    // Optional: Date of original chapter's publication as a string if it exists.

    constructor({
        number,
        identifier,
        title,
        description = null,
        group = null,
        variant = null,
        created = null,
        updated = null,
        published = null,
    }) {
        this.number = number;
        this.identifier = identifier;
        this.title = title;
        this.description = description;
        this.group = group;
        this.variant = variant;
        this.created = created;
        this.updated = updated;
        this.published = published;
    }
}

class ChapterList {
    chapters = [];
    // Chapters contains all the chapters for a given manga series.
    //

    constructor({ chapters }) {
        this.chapters = chapters;
    }
}

class ChapterData {
    pageUrls = [];
    // PageUrls contains all the page urls for the chapter.

    constructor({ pageUrls }) {
        this.pageUrls = pageUrls;
    }
}

class MangaSeries {
    name = "";
    // Name is the name of the manga series.
    // 
    identifier = "";
    // Identifier is the id or unique identifier for this manga series on this
    // source.
    // 
    ranking = -1;
    // NOTE: Optional
    // Ranking is the a representation of the likelyhood of this result being
    // the correct match. 0 being the best match and Number.MAX_SAFE_INTEGER
    // being the worst match. All negative numbers will be treated as equal.
    //
    coverUrl = null;
    // NOTE: Optional
    // The coverUrl if one exists. Used to help users identify best matches.

    constructor({ name, identifier, ranking = -1, coverUrl = null }) {
        this.name = name;
        this.identifier = identifier;
        this.ranking = ranking;
        this.coverUrl = coverUrl;
    }
}

class MangaSeriesList {
    results = [];
    // Results is the list of all MangaSeries objects which match this query in
    // a searchManga call.

    constructor({ results = [] }) {
        this.results = results;
    }

    addResult({ name, identifier, ranking = -1 }) {
        this.results.push(MangaSeries({ name, identifier }));
    }
}

export let EXTENSION_ID="6bbba1ba-258c-11ec-831b-784f43a622c7";

export async function searchManga(seriesName, offset=0, limit=10) {
    console.debug("searchManga called.");
    let finalUrl = new URL("https://bato.to/search");
    console.debug("Initialized url.", { url: finalUrl });
    let searchParams = new URLSearchParams({
        word: seriesName,
    });
    finalUrl.search = searchParams.toString();
    console.debug("Added search params.", { url: finalUrl });

    const response = await fetch(finalUrl);
    const text = await response.text();

    const $ = cheerio.load(text);
    const elements = $("div#series-list div.col.no-flag");
    const idRegex = /\/series\/(?<id>\d+)\/[^\/]*/;

    const results = elements.map((i, result) => {
        const title = $(result).find("a.item-title");
        console.log(`title: ${title}`);
        const cleanedTitle = title.text().replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();
        console.log(`cleanedTitle: ${cleanedTitle}`);
        const url = title.attr("href");
        const id = url.match(idRegex)[1];
        console.log(`id: ${id}`);

        const coverElem = $(result).find("a.item-cover > img")
        const coverUrl = coverElem.attr("src");

        const newSeries = new MangaSeries({
            identifier: id,
            name: cleanedTitle,
            ranking: i,
            coverUrl: coverUrl
        });
        console.log(newSeries);
        return newSeries;
    });

    return new MangaSeriesList({
        results: results,
    })
}

export async function listChapters(
    seriesIdentifier, offset=0, limit=500, since=null, order='asc'
) {
    const finalUrl = new URL(`https://bato.to/series/${seriesIdentifier}`);

    const response = await fetch(finalUrl);
    const text = await response.text();

    const $ = cheerio.load(text);
    const elements = $("a.chapt");
    const idRegex = /\/chapter\/(?<id>\d+)/;
    const timeRegex = /(\d+)\s+(sec|min|hour|day)s? ago/;
    const chapterNumberRegex = /ch(?:ap(?:ter)?)?[\s\.]*(\d+(\.\d+)?)/i;

    const chapters = elements.map((_, elem) => {
        const cleanedTitle = $(elem).text().replace(/\s+/g, " ").trim();
        console.log(`cleanedTitle: ${cleanedTitle}`);

        if (cleanedTitle.toLocaleLowerCase().includes("deleted")) {
            return null;
        }

        const url = $(elem).attr('href');
        const id = url.match(idRegex)[1];
        const numberMatch = cleanedTitle.match(chapterNumberRegex);
        if (!numberMatch) {
            return null;
        }
        const number = numberMatch[1];

        let chapItem = new ChapterListItem({
            identifier: id,
            title: cleanedTitle,
            number: number,
            // group: groupName,
            // created: createdAt,
            // updated: updatedAt,
            // published: publishAt,
        });
        // console.debug(`Creating final ChapterListItem`, chapItem);
        return chapItem;
    }).filter(x => x);

    // console.debug(`Creating final chapter list.`, { chapters });
    const chapList = new ChapterList({
        chapters: chapters,
    });

    return chapList;
}

export async function getChapter(chapterIdentifier) {
    // TODO: implement get chapter logic here.

    let response = await fetch(
        `https://bato.to/chapter/${chapterIdentifier}`
    );
    let text = await response.text();
    // NOTE: This fuckin sucks

    const serverRegex = /const server\s*=\s*"([^"]+)";/i;
    const encryptionRegex = /const batojs\s*=\s*([^;]+);/i;
    const imagesRegex = /const images\s*=\s*(\[[^\]]+\]);/i;
    const imagesMatch = text.match(imagesRegex)[1];
    const serverMatch = text.match(serverRegex)[1];
    const encryptionKey = eval(text.match(encryptionRegex)[1]);

    const imgsArray = JSON.parse(imagesMatch);
    const server = JSON.parse(
        CryptoJS.AES.decrypt(
            serverMatch,
            encryptionKey
        ).toString(CryptoJS.enc.Utf8)
    );

    const pageUrls = imgsArray.map(url => (
        `${server}/${url}`
    ));
    
    // const $ = cheerio.load(text);
    // const elements = $("div#viewer div.item");
    // const pageUrls = elements.map((_, elem) => {
    //     const imgElem = $(elem).find("img.page-img");
    //     console.log(`imgElem: ${imgElem}`);
    //     const imgLink = imgElem.prop("src");
    //     console.log(`imgLink: ${imgLink}`);
    //     return imgLink;
    // });

    return new ChapterData({ pageUrls: pageUrls });
}
