(function () {
	globalThis.__LAST_LOADED__ = 'bmddm';
	globalThis.__SOURCES__ = globalThis.__SOURCES__ || {};
	if (globalThis.__SOURCES__['bmddm']) return;
	var __NET_INTERCEPT_MODE__ = 'false';

	function sendToFlutter(msg) {
		window.FlutterBridge && window.FlutterBridge.postMessage(JSON.stringify(msg))
	}

	function sniffLog(text) {
		sendToFlutter({
			msgType: 'log',
			payload: String(text)
		})
	}

	function getId(uri) {
		const url = new URL(uri);
		const path = url.pathname;
		const filename = path.split('/').pop();
		return filename.replace('.html', '')
	}
	async function sniffResource() {
		var list = document.querySelectorAll('.lpic li');
		if (!list || 0 == list.length) {
			return []
		}
		const resourceList = [];
		for (const item of list) {
			var aTitle = item.querySelector('h2 a');
			if (!aTitle) continue;
			var url = aTitle.href;
			var img = item.querySelector('img');
			var p = item.querySelector('p');
			resourceList.push({
				id: getId(url),
				name: aTitle.textContent,
				url: url,
				img: img.getAttribute('src'),
				blurb: p.textContent
			})
		}
		return resourceList
	}
	async function sniffEpisode() {
		const root = Array.from(document.querySelectorAll('.tabs')).find(el => {
			return el.querySelector('.menu0 li')?.textContent.includes('播放Ⅰ')
		});
		if (!root) {
			return {}
		}
		var menuList = root.querySelectorAll('#menu0 li');
		var sourceList = root.querySelectorAll('#main0 .movurl');
		if (!sourceList || 0 == sourceList.length) {
			return {}
		}
		var sourceMap = {};
		for (var i = 0; i < sourceList.length; i++) {
			var episodeList = sourceList[i].getElementsByTagName('a');
			if (0 == episodeList.length) continue;
			sourceMap[menuList[i].textContent] = Array.from(episodeList).map(item => ({
				name: item.textContent,
				url: item.href
			}))
		}
		return sourceMap
	}
	
	function netIntercept() { }

	async function sniffPlayUrl() { }
	globalThis.__SOURCES__['bmddm'] = {
		requires: ['ultrahtml'],
		methods: {
			search: sniffResource,
			detail: sniffEpisode,
			play: sniffPlayUrl,
		},
		events: {
			channel: 'FlutterBridge'
		},
	}

	if (__NET_INTERCEPT_MODE__ === true) {
		netIntercept();
	}
})();