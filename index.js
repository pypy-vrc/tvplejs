var _ = require('underscore');
var fs = require('fs');
var crypto = require('crypto');
var http = require('http');
var app = require('express')();
var server = http.Server(app);

// tvple

function SHA1(s) {
	var shasum = crypto.createHash('sha1');
	shasum.update(s);
	return shasum.digest('hex');
}

function hexEncode(s) {
	var i, a = [], hex = '0123456789abcdef';

	for (i = 0; i < s.length; ++i) {
		var c = s.charCodeAt(i);

		if (c & ~255) {
			a.push(hex.charAt((c >> 12) & 15));
			a.push(hex.charAt((c >> 8) & 15));
		}

		a.push(hex.charAt((c >> 4) & 15));
		a.push(hex.charAt(c & 15));
	}

	return a.join('');
}

function hexDecode(s) {
	var i, a = [];

	for (i = 0; i < s.length; i += 2) {
		var c = parseInt(s.substr(i, 2), 16);

		if (c & 128)
			c = (c << 8) | parseInt(s.substr(i += 2, 2), 16);

		a.push(String.fromCharCode(c));
	}

	return a.join('');
}

function tvpleEncode(s) {
	var i, a = [], aa = [], k = '0123456789abcdef', h = SHA1(s);

	for (i = 0; i < 128; ++i)
		a.push(String.fromCharCode(i));

	for (i = 0; i < 10; ++i)
		a[k.charCodeAt(i + 1)] = k.charAt(10 - i);

	s = hexEncode(s);

	for (i = s.length; i; --i)
		aa.push(a[s.charCodeAt(i - 1)]);

	return 'feff0123456789abcdef_0123456789abcdef0123456789abcdef0123456789abcdef' + k + h + aa.join('');
}

function tvpleDecode(s) {
	if (s.substr(0, 4) == 'feff' && s.charAt(20) == '_') {
		var i, a = [], aa = [];

		for (i = 0; i < 128; ++i)
			a.push(String.fromCharCode(i));

		for (i = 0; i < 10; ++i)
			a[s.charCodeAt(i + 70)] = s.charAt(79 - i);

		for (i = s.length; i > 125; --i)
			aa.push(a[s.charCodeAt(i - 1)]);

		var result = hexDecode(aa.join(''));

		if (SHA1(result) == s.substr(85, 40))
			return result;
	}
}

function buildTvpleToken(videoId) {
	return tvpleEncode([
		'2.40202',
		'f2f2f2f2',
		'http://127.0.0.1:8080/crossdomain.xml',
		'http://127.0.0.1:8080/ticket/' + videoId
	].join('\n'));
}

function buildTvpleTicket(videoId) {
	return tvpleEncode([
		'<?xml version="1.0" encoding="UTF-8" ?>',
		'<tvple>',
		'<version>2.40202</version>',
		'<video>',
		'<url>http://127.0.0.1:8080/static/tvple/' + videoId + '.mp4</url>',
		'<state>0</state>',
		'<loop>1</loop>',
		'<preview>',
		'<policy>http://127.0.0.1:8080/crossdomain.xml</policy>',
		'<position>0</position>',
		'<title></title>',
		'<url>http://127.0.0.1:8080/static/tvple/' + videoId + '.jpg</url>',
		'</preview>',
		'</video>',
		'<misc>',
		'<url>http://127.0.0.1:8080/static/tvple/' + videoId + '.xml</url>',
		'</misc>',
		'</tvple>'
	].join(''));
}

var tvpleDB = {};

(function updateTvpleDB() {
	fs.readFile(__dirname + '/static/tvple/db.txt', 'utf8', function (err, data) {
		if (!err) {
			data = data.trim();
			if (data.charAt(data.length - 1) == ',')
				data = data.substr(0, data.length - 1);
			tvpleDB = JSON.parse('{' + data + '}');
		}
		setTimeout(updateTvpleDB, 30 * 1000);
	});
})();

// express

var bodyParser = require('body-parser');
var compression = require('compression');
var serveStatic = require('serve-static');
var serveFavicon = require('serve-favicon');
var serveIndex = require('serve-index');
var morgan = require('morgan');

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(serveFavicon(__dirname + '/static/favicon.ico'));
app.use('/static', serveStatic(__dirname + '/static'/*, {index: ['index.htm', 'index.html']}*/));
//app.use('/static', serveIndex(__dirname + '/static', {icons: true}));
app.use(compression({ threshold: 512 }));
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(morgan({ format: 'dev', immediate: true }));

app.get('/', function (req, res) {
	res.render('index', {
		name: 'mina'
	});
});

app.get('/db', function (req, res) {
	res.send(tvpleDB);
});

app.get('/:videoId', function (req, res) {
	var videoId = req.params.videoId;
	res.render('play', {
		videoId: videoId,
		title: tvpleDB[videoId],
		token: buildTvpleToken(videoId)
	});
});

app.get('/ticket/:videoId', function (req, res) {
	res.send(buildTvpleTicket(req.params.videoId));
});

app.get('/crossdomain.xml', function (req, res) {
	res.send([
		'<?xml version="1.0" encoding="UTF-8" ?>',
		'<!DOCTYPE cross-domain-policy SYSTEM "http://www.adobe.com/xml/dtds/cross-domain-policy.dtd">',
		'<cross-domain-policy>',
		'<site-control permitted-cross-domain-policies="master-only"/>',
		'<allow-access-from domain="127.0.0.1:8080" />',
		'</cross-domain-policy>'
	].join(''));
});

/*
// GET : call "/puttest?id=1234"
app.put('/gettest', function(req, res) {
	res.send('received id :' + req.query.id);
});

// POST(form) : call "/posttest" with form parameter "id=9"
app.put('/posttest', function(req, res) {
	res.send('received id :' + req.body.id);
});

// RESTful : call "/restful/3"
app.put('/restful/:id', function(req, res) {
	res.send('received id :' + req.params.id);
});
*/

server.listen(8080);