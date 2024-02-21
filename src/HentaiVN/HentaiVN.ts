import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    TagType,
    TagSection,
    ContentRating,
    Request,
    Response,
    MangaTile,
    Tag,
    LanguageCode,
    HomeSectionType
} from "paperback-extensions-common"
import { parseSearch, isLastPage, parseViewMore, decodeHTMLEntity } from "./HentaiVNParser"

const DOMAIN = 'https://hentaivn.tv'
const method = 'GET'

export const HentaiVNInfo: SourceInfo = {
    version: '3.0.5',
    name: 'HentaiVN',
    icon: 'icon.png',
    author: 'dongtho123',
    authorWebsite: 'https://github.com/dongtho123,
    description: 'Extension that pulls manga from HentaiVN    ',
    websiteBaseURL: `https://hentaivn.tv`,
    contentRating: ContentRating.MATURE,
    sourceTags: [
        {
            text: "18+",
            type: TagType.BLUE
        }
    ]
}
export class Blogtruyen extends Source {
    getMangaShareUrl(mangaId: string): string { return `https://hentaivn.tv${mangaId}` };
    requestManager = createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {

                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': DOMAIN
                    }
                }

                return request
            },

            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    })
    
async getMangaDetails(mangaId: string): Promise<Manga> {
        const url = `${mangaId}`;
        const request = createRequestObject({
            url: url,
            method: "GET",
         });
        let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        let tags: Tag[] = [];
        let creator = $('.author > i > a').text().trim();
        let status = $('.tsinfo  > .imptdt:first-child > i').text().trim(); //completed, 1 = Ongoing
        let statusFinal = status.toLowerCase().includes("đang") ? 1 : 0;
        let desc = $(".comic-description > .inner").text().trim();
        for (const t of $('.genre > a').toArray()) {
            const genre = $(t).text().trim();
            const id = $(t).attr('href') ?? genre;
            tags.push(createTag({ label: genre, id }));
        }
        const image = $('.comic-info .book > img').attr('src') ?? "";
        return createManga({
            id: mangaId,
            author: creator,
            artist: creator,
            desc: decodeHTMLEntity(desc),
            titles: [decodeHTMLEntity($('.post-title > h1').text().trim())],
            image: encodeURI(image),
            status,
            // rating: parseFloat($('span[itemprop="ratingValue"]').text()),
            hentai: true,
            tags: [createTagSection({ label: "genres", tags: tags, id: '0' })]
        });

    }
    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${mangaId}`,
            method,
        });
        let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        const chapters: Chapter[] = [];
        var i = 0;
        for (const obj of $('.bixbox > .chap-list > .d-flex ').toArray().reverse()) {
            i++;
            let id = $('a', obj).first().attr('href');
            let name = $('a > span:first-child', obj).text().trim();
            let cc = $('a > span:first-child', obj).text().trim();
            let chapNum = Number(cc.includes('Chapter') ? cc.split('Chapter')[1].trim() : 'cc');
            let time = $('a > span:last-child', obj).text().trim().split('/');
            chapters.push(createChapter(<Chapter>{
                id,
                chapNum: isNaN(chapNum) ? i : chapNum,
                name,
                mangaId: mangaId,
                langCode: LanguageCode.VIETNAMESE,
                time: new Date(time[1] + '/' + time[0] + '/' + time[2])
            }));
        }

        return chapters;
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${chapterId}`,
            method
        });
  let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        const pages: string[] = [];
        for (let obj of $('.content-text img').toArray()) {
            let link = $(obj).attr('src') ?? "";
            pages.push(encodeURI(link));
        }
        const chapterDetails = createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        });
        return chapterDetails;
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        let featured: HomeSection = createHomeSection({
            id: 'featured',
            title: "Gợi ý hôm nay",
            type: HomeSectionType.featured
        });
        let top: HomeSection = createHomeSection({
            id: 'top',
            title: "Top view ngày",
            view_more: false,
        });
        let hot: HomeSection = createHomeSection({
            id: 'hot',
            title: "Hot tháng",
            view_more: false,
        });
        let newUpdated: HomeSection = createHomeSection({
            id: 'new_updated',
            title: "Mới cập nhật",
            view_more: true,
        });
        let view: HomeSection = createHomeSection({
            id: 'view',
            title: "Xem nhiều nhất",
            view_more: true,
        });
        let newest: HomeSection = createHomeSection({
            id: 'new',
            title: "Mới thêm",
            view_more: true,
        });


        //Load empty sections
        sectionCallback(top);
        sectionCallback(hot);
        sectionCallback(newUpdated);
        sectionCallback(view);
        sectionCallback(newest);

        ///Get the section data
        //Featured
        let request = createRequestObject({
            url: 'https://hentaivn.tv/',
            method: "GET",
        });
        let featuredItems: MangaTile[] = [];
        let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        for (let obj of $('.item__wrap ', '.slider__container .slider__item').toArray()) {
            let title = $(`.slider__content .post-title`, obj).text().trim();
            let subtitle = $(`.slider__content .chapter-item a`, obj).first().text().trim();
            const image = $('.slider__thumb a > img', obj).attr('data-src') ? $('.slider__thumb a > img', obj).attr('data-src').replace('-110x150', '') : $('.slider__thumb a > img', obj).attr('src').replace('-110x150', '');
            let id = $(`.slider__thumb a`, obj).attr('href') ?? title;
            featuredItems.push(createMangaTile({
                id: id,
                image: encodeURI(image),
                title: createIconText({
                    text: decodeHTMLEntity(title),
                }),
                subtitleText: createIconText({
                    text: (subtitle),
                }),
            }));
        }
        featured.items = featuredItems;
        sectionCallback(featured);

        //top
        let request = createRequestObject({
            url: 'https://hentaivn.tv/',
            method: "GET",
        });
        let topItems: MangaTile[] = [];
        data = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(data.data);
        for (let obj of $('.popular-item-wrap', '#manga-recent-2 .widget-content').toArray()) {
            let title = $(`.popular-content a`, obj).text().trim();
            const image = $(`.popular-img > a > img`, obj).attr('data-src') ? $(`.popular-img > a > img`, obj).attr('data-src').replace('-75x106', '') : $(`.popular-img > a > img`, obj).attr('src').replace('-75x106', '');
            let id = $(`.popular-img > a`, obj).attr('href') ?? title;
            topItems.push(createMangaTile({
                id: id,
                image: encodeURI(image),
                title: createIconText({
                    text: decodeHTMLEntity(title),
                })
            }));
        }
        top.items = topItems;
        sectionCallback(top);

        //Hot
        let request = createRequestObject({
            url: 'https://hentaivn.tv/',
            method: "GET",
        });
        let hotItems: MangaTile[] = [];
        data = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(data.data);
        for (let obj of $('.popular-item-wrap', '#manga-recent-3 .widget-content').toArray()) {
            let title = $(`.popular-content a`, obj).text().trim();
            const image = $(`.popular-img > a > img`, obj).attr('data-src') ? $(`.popular-img > a > img`, obj).attr('data-src').replace('-75x106', '') : $(`.popular-img > a > img`, obj).attr('src').replace('-75x106', '');
            let id = $(`.popular-img > a`, obj).attr('href') ?? title;
            hotItems.push(createMangaTile({
                id: id,
                image: encodeURI(image),
                title: createIconText({
                    text: decodeHTMLEntity(title),
                })
            }));
        }
        hot.items = hotItems;
        sectionCallback(hot);

        //New Updates
        let request = createRequestObject({
            url: 'https://hentaivn.tv/',
            method: "GET",
        });
        let newUpdatedItems: MangaTile[] = [];
        data = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(data.data);
        for (let obj of $('.c-tabs-item__content', '.tab-content-wrap').toArray()) {
            let title = $(`.post-title > h3 > a`, obj).text().trim();
            let subtitle = $(`.chapter > a`, obj).text().trim();
            const image = $('.c-image-hover > a > img', obj).attr('data-src') ?? $('.c-image-hover > a > img', obj).attr('src');
            let id = $(`.c-image-hover > a`, obj).attr('href') ?? title;
            newUpdatedItems.push(createMangaTile({
                id: id ?? "",
                image: encodeURI(image),
                title: createIconText({
                    text: decodeHTMLEntity(title) ?? "",
                }),
                subtitleText: createIconText({
                    text: subtitle
                }),
            }));
        }
        newUpdated.items = newUpdatedItems;
        sectionCallback(newUpdated);

        //view
         let request = createRequestObject({
            url: 'https://hentaivn.tv/',
            method: "GET",
        });
        let newAddItems: MangaTile[] = [];
        data = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(data.data);
        for (let obj of $('.c-tabs-item__content', '.tab-content-wrap').toArray()) {
            let title = $(`.post-title > h3 > a`, obj).text().trim();
            let subtitle = $(`.chapter > a`, obj).text().trim();
            const image = $('.c-image-hover > a > img', obj).attr('data-src') ?? $('.c-image-hover > a > img', obj).attr('src');
            let id = $(`.c-image-hover > a`, obj).attr('href') ?? title;
            newAddItems.push(createMangaTile({
                id: id,
                image: encodeURI(image),
                title: createIconText({
                    text: title,
                }),
                subtitleText: createIconText({
                    text: (subtitle),
                }),
            }));
        }
        view.items = newAddItems;
        sectionCallback(view);

        //Newest
         let request = createRequestObject({
            url: 'https://hentaivn.tv/',
            method: "GET",
        });
        let newItems: MangaTile[] = [];
        data = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(data.data);
        for (let obj of $('.c-tabs-item__content', '.tab-content-wrap').toArray()) {
            let title = $(`.post-title > h3 > a`, obj).text().trim();
            let subtitle = $(`.chapter > a`, obj).text().trim();
            const image = $('.c-image-hover > a > img', obj).attr('data-src') ?? $('.c-image-hover > a > img', obj).attr('src');
            let id = $(`.c-image-hover > a`, obj).attr('href') ?? title;
            newItems.push(createMangaTile({
                id: id ?? "",
                image: encodeURI(image),
                title: createIconText({
                    text: title ?? "",
                }),
                subtitleText: createIconText({
                    text: subtitle
                }),
            }));
        }
        newest.items = newItems;
        sectionCallback(newest);
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1;
        let url = '';
        let select = 1;
        switch (homepageSectionId) {
            case "new":
                url = `https://hentaivn.tv/page/${page}/?s&post_type=wp-manga&m_orderby=new-manga`;
                select = 0;
                break;
            case "new_updated":
                url = `https://hentaivn.tv/${page}/?s&post_type=wp-manga&m_orderby=latest`;
                select = 1;
                break;
            case "view":
                url = `https://hentaivn.tv/page/${page}/?s&post_type=wp-manga&m_orderby=views`;
                select = 2;
                break;
            default:
                return Promise.resolve(createPagedResults({ results: [] }));
        }

        const request = createRequestObject({
            url,
            method
        });

        url = url2;
        const request2 = createRequestObject({
            url, // url = url2
            method
        });

        let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        let manga = parseViewMore($);
        metadata = !isLastPage($) ? { page: page + 1 } : undefined;
        return createPagedResults({
            results: manga,
            metadata,
        });
    }

   async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1;
        const tags = query.includedTags?.map(tag => tag.id) ?? [];
        const request = createRequestObject({
            url: query.title ? encodeURI(`https://hentaivn.tv/page/${page}/?s=${query.title}`) : 
       tags[0] + `page/${page}/`,
            method: "GET",
        });

        let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        const tiles = parseSearch($);

        metadata = { page: page + 1 };

        return createPagedResults({
            results: tiles,
            metadata
        });
    }

    async getSearchTags(): Promise<TagSection[]> {
        const tags: Tag[] = [];
        const url = `https://hentaivn.tv/`;
        const request = createRequestObject({
            url: url,
            method: "GET",
        });
        let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        //the loai
        for (const tag of $('.genre a').toArray()) {
            const label = $(tag).text().trim();
            const id = $(tag).attr('href');
            if (!id || !label) continue;
            tags.push({ id: id, label: label });
        }
        const tagSections: TagSection[] = [
            createTagSection({ id: '1', label: 'Thể Loại', tags: tags.map(x => createTag(x)) }),
        ];
        return tagSections;
    }
}
