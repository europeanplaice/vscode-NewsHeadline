import * as vscode from 'vscode';
let myStatusBarItem: vscode.StatusBarItem;
import axios, { AxiosResponse } from "axios";
import { JSDOM } from 'jsdom';

let currentHeadline: string;

interface News {
    [attr: string]: string
}

let newsgroup: News[] = [{}];

async function loopbody(urls: string[]) {
	let tempNewsgroup: News[] = [{}];
	var yesterday = new Date();
	yesterday.setHours(yesterday.getHours() - 6);
	let yesterdayNum = yesterday.getTime();
	for (let url of urls) {
		await axios.get(url)
		.then(async (res: AxiosResponse<string>) => {
			const jsdom = new JSDOM();
			const parser = new jsdom.window.DOMParser();
			const doc = parser.parseFromString(await res["data"], "text/xml");
			doc.documentElement.querySelectorAll("item").forEach((item) => {
				let pubdate = item.querySelector("pubDate");
				if (!pubdate) {return;};
				let title = item.querySelector("title");
				if (!title){return;};
				if (!pubdate.textContent){return;};
				let datestring = pubdate.textContent;
				if (!title.textContent){return;};
				let date = new Date(datestring);
				let utcdate = new Date(
					date.getUTCFullYear(),
					date.getUTCMonth(),
					date.getUTCDate(),
					date.getUTCHours(),
					date.getUTCMinutes(),
					date.getUTCSeconds()
				);
				let japandate = new Date(utcdate);
				japandate.setHours(japandate.getHours() + 9);
				
				let description = item.querySelector("description")?.textContent;
				let link: string | null | undefined;
				let provider: string = "(NHK)";
				link = item.querySelector("guid")?.textContent;
				if (!link){
					provider = "";
					link = item.querySelector("link")?.textContent;
				}

				let content = `${title.textContent} ${provider}(${japandate.getDate()}日${japandate.getHours()}:${( '00' + japandate.getMinutes()).slice( -2 )})`;
				
				if (title && description && link && japandate.getTime() > yesterdayNum) {
                    let news: News = {
                        "title": content,
                        "description": description,
                        "link": link
                    };
                    tempNewsgroup.push(news);
				} else {
					console.log("err");
				}
			});
		});
	}
    console.log("update");
	newsgroup = await JSON.parse(JSON.stringify(tempNewsgroup));
	return newsgroup;
}

async function showLatestNews(newsgroup: News[]) {
	let idx = Math.floor(Math.random() * newsgroup.length);
	let rssTitle = `$(book)` + newsgroup[idx]["title"];
	const title = rssTitle ? rssTitle : "unknown";

	currentHeadline = newsgroup[idx]["link"];
	myStatusBarItem.text = title;
	myStatusBarItem.tooltip = newsgroup[idx]["description"];
	myStatusBarItem.name = "ニュース速報";
	myStatusBarItem.command = "vscode-NewsHeadline.openlink";
	myStatusBarItem.show();
}

async function getLatestNews() {
	let urls: string[] = [
		"https://www.nhk.or.jp/rss/news/cat1.xml",
		"https://www.nhk.or.jp/rss/news/cat3.xml",
		"https://www.nhk.or.jp/rss/news/cat4.xml",
		"https://www.nhk.or.jp/rss/news/cat5.xml",
		"https://www.nhk.or.jp/rss/news/cat6.xml",
	];

	await loopbody(urls);
	};

export async function activate(context: vscode.ExtensionContext) {
	
	let disposable1 = vscode.commands.registerCommand('vscode-NewsHeadline.openlink', async () => {
		vscode.env.openExternal(vscode.Uri.parse(currentHeadline));
	});

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
	myStatusBarItem.text = "ニュース取得中...";
	myStatusBarItem.show();
	await getLatestNews();
	showLatestNews(newsgroup);
	setInterval(getLatestNews, 600000);
	setInterval(showLatestNews, 45000, newsgroup);

	context.subscriptions.push(disposable1);
	context.subscriptions.push(myStatusBarItem);
}

export function deactivate() {}
