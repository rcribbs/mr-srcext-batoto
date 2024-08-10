// @flow
import "core-js/stable";
import "core-js/features/url";

const cheerio = require("cheerio");
const CryptoJS = require("crypto-js");

class ChapterListItem {
    number: string;
    // Number is the chapter number. Could be an actual number like "1" or could
    // be a special chapter like "EX" or "Omake".
    //
    title: string;
    // Name is the short title of the chapter.
    // 
    description: string;
    // Description is the longer description of the chapter. May be blank
    // depending on the way the website handles information about chapters.
    // 
    identifier: string;
    // Identifier is a source-specific identifier. Could be an id like "1234" or
    // anything that makes sense for this source. This identifier will be
    // provided in getChapter call as chapterIdentifier to retrieve the chapter
    // pages.
    // 
    group: ?string
    // Optional: Scanalation group if one exists.
    // 
    variant: ?string
    // Optional: Set variant if there are multiple versions of the same chapter
    //           and group is not present or not enough to differintiate.
    //
    created: ?Date
    // Optional: Date created as a string if it exists.

    updated: ?Date
    // Optional: Date updated as a string if it exists.

    published: ?Date
    // Optional: Date of original chapter's publication as a string if it exists.

    constructor({
        number,
        identifier,
        title,
        description = "",
        group = null,
        variant = null,
        created = null,
        updated = null,
        published = null,
    }: {
        number: string,
        identifier: string,
        title: string,
        description?: string,
        group?: ?string,
        variant?: ?string,
        created?: ?Date,
        updated?: ?Date,
        published?: ?Date,
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
    chapters: Array<ChapterListItem>;
    // Chapters contains all the chapters for a given manga series.
    //

    constructor({ chapters }: { chapters: Array<ChapterListItem> }) {
        this.chapters = chapters;
    }
}


type PageDataHandler = (string) => (string);

class PageData {
    version: string = "1.0.0"
    highUrl: string
    lowUrl: ?string
    highHandler: ?PageDataHandler
    lowHandler: ?PageDataHandler

    constructor({
        highUrl,
        lowUrl = null,
        highHandler = null,
        lowHandler = null,
    }: {
        highUrl: string,
        lowUrl?: ?string,
        highHandler?: ?PageDataHandler,
        lowHandler?: ?PageDataHandler,
    }) {
        this.highUrl = highUrl;
        this.lowUrl = lowUrl;
        this.highHandler = highHandler;
        this.lowHandler = lowHandler;
    }
}

class ChapterData {
    version: string = "2.0.0"

    pages: Array<PageData>

    constructor({ pages }: { pages: Array<PageData> }) {
        this.pages = pages
    }
}

class MangaSeries {
    name: string;
    // Name is the name of the manga series.
    // 
    identifier: string;
    // Identifier is the id or unique identifier for this manga series on this
    // source.
    // 
    coverUrl: ?string;
    // NOTE: Optional
    // The coverUrl if one exists. Used to help users identify best matches.
    ranking: number;
    // NOTE: Optional
    // Ranking is the a representation of the likelyhood of this result being
    // the correct match. 0 being the best match and Number.MAX_SAFE_INTEGER
    // being the worst match. All negative numbers will be treated as equal.
    // 

    constructor({
        name,
        identifier,
        coverUrl = null,
        ranking = -1,
    }: {
        name: string,
        identifier: string,
        coverUrl?: ?string,
        ranking?: number,
    }) {
        this.name = name;
        this.identifier = identifier;
        this.coverUrl = coverUrl;
        this.ranking = ranking;
    }
}

class MangaSeriesList {
    results: Array<MangaSeries> = [];
    // Results is the list of all MangaSeries objects which match this query in
    // a searchManga call.

    constructor({ results = [] }: { results: Array<MangaSeries> }) {
        this.results = results;
    }
}

export let EXTENSION_ID: string="6bbba1ba-258c-11ec-831b-784f43a622c7";

function parsePage($): Array<MangaSeries> {
    const elements = $("div#series-list div.col.no-flag");
    const idRegex = /\/series\/(?<id>\d+)\/[^\/]*/;

    const results: Array<?MangaSeries> = elements.map((i, result) => {
        const title = $(result).find("a.item-title");
        console.debug(`title: ${title}`);
        const cleanedTitle = title.text().replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();
        console.log(`cleanedTitle: ${cleanedTitle}`);
        const url = title.attr("href");
        const idMatch = url.match(idRegex);
        if (!idMatch || idMatch.length <= 1) {
            return null;
        }
        const id = idMatch[1];
        console.debug(`id: ${id}`);

        const coverElem = $(result).find("a.item-cover > img")
        const coverUrl = coverElem.attr("src");

        const newSeries = new MangaSeries({
            identifier: id.toString(),
            name: cleanedTitle.toString(),
            ranking: i,
            coverUrl: coverUrl.toString()
        });
        console.debug(newSeries);
        return newSeries;
    }).toArray();

    const finalResults: Array<MangaSeries> = results.filter(Boolean);

    return finalResults;
}

export async function searchManga(seriesName: string, offset: number=0, limit: number =10): Promise<MangaSeriesList> {
    console.debug("searchManga called.");
    let baseUrl = new URL("https://bato.to/search");

    let totalPages: ?number = null;
    let pageNumber = 1;
    let allResults: Array<MangaSeries> = [];

    do {
        let currentUrl = baseUrl;
        console.debug("Initialized url.", { url: currentUrl });
        let searchParams = new URLSearchParams({
            word: seriesName,
            page: pageNumber.toString(),
        });
        currentUrl.search = searchParams.toString();
        console.debug("Added search params.", { url: currentUrl });

        const response = await fetch(currentUrl);
        const text = await response.text();

        const cheerioData = cheerio.load(text);

        if (totalPages == null) {
            // -2 here because the page links include the
            // "back and forward" buttons.
            // 
            totalPages = Math.max(cheerioData(".page-link").length - 2, 1);
        }

        const newResults: Array<MangaSeries> = parsePage(cheerioData);
        console.log("Processed page of results.", { pageNumber, result_count: newResults.length });
        console.debug("Found series on page.", { newResults });
        allResults = allResults.concat(newResults);
        pageNumber += 1;
    } while (pageNumber < (totalPages + 1))

    console.log("Parsed all pages of search results.", { results_found: allResults.length });

    return new MangaSeriesList({
        results: allResults,
    });
}

export async function listChapters(
    seriesIdentifier: string,
    offset: number=0,
    limit: number=500,
    since: ?Date=null,
    order: string='asc'
): Promise<ChapterList> {
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

export async function getChapter(chapterIdentifier: string): Promise<ChapterData> {
    // TODO: implement get chapter logic here.

    let response = await fetch(
        `https://bato.to/chapter/${chapterIdentifier}`
    );
    let text = await response.text();
    // NOTE: This fuckin sucks

    const batoWordRegex = /const batoWord\s*=\s*"([^"]+)";/i;
    const batoPassRegex = /const batoPass\s*=\s*(?:\[\+\[\]\]\+)*([^;]+);/i;
    const imagesRegex = /const imgHttps\s*=\s*(\[[^\]]+\]);/i;
    let matches = text.match(batoPassRegex);
    if (!matches || matches.length <= 1) {
        throw Error("Failed to get decryption code for page.");
    }

    const rawBatoPass = matches[1];
    console.debug("Printing raw batoPass.", {
        rawBatoPass
    });

    console.debug("Evaling page JS.")
    matches = text.match(imagesRegex);
    if (!matches || matches.length <= 1) {
        throw Error("Failed to get images for page.");
    }
    const imgHttpLis = eval(matches[1]);

    const batoPass = eval(rawBatoPass);
    console.debug("Evaling batoWord.");

    matches = text.match(batoWordRegex);
    if (!matches || matches.length <= 1) {
        throw Error("Failed to get data (batoWord) for page.");
    }
    const batoWord = [1];

    console.debug("Finished pulling data from page.");

    const imgWordLis = JSON.parse(
        CryptoJS.AES.decrypt(
            batoWord,
            batoPass,
        ).toString(
            CryptoJS.enc.Utf8
        )
    );

    console.debug("Gathered img information.", {
        imgWordLis: imgWordLis,
        imgHttpLis: imgHttpLis,
    });

    const pages = imgHttpLis.map((url, i) => (
        new PageData({ highUrl: `${url}?${imgWordLis[i]}` })
    ));
    
    return new ChapterData({ pages });
}
