var express = require('express');
var AWS = require('aws-sdk');
var mu = require('mu2');
var uuid = require('uuid');
var multiparty = require('multiparty');
var puppeteer = require("puppeteer");
var bodyParser = require('body-parser')
var fs = require("fs");


var app = express();

var s3 = new AWS.S3({
	'region': 'us-east-1'
});

var bucket = process.argv[2];
if (!bucket || bucket.length < 1) {
	console.error('Missing S3 bucket. Start with node server.js BUCKETNAME instead.');
	process.exit(1);
}

function listImages(response) {
	var params = {
		Bucket: bucket
	};
	s3.listObjects(params, function(err, data) {
		if (err) {
			console.error(err);
			response.status(500);
			response.send('Internal server error.');
		} else {
			console.log(data.Contents)
			var stream = mu.compileAndRender(
				'index.html', 
				{
					Objects: data.Contents, 
					Bucket: bucket
				}
			);
			stream.pipe(response);
		}
	});
}

function uploadImage(image, response) {
	var params = {
		Body: image,
		Bucket: bucket,
		Key: uuid.v4(),
		ACL: 'public-read',
		ContentLength: image.byteCount,
		ContentType: image.headers['content-type']
	};
	s3.putObject(params, function(err, data) {
		if (err) {
			console.error(err);
			response.status(500);
			response.send('Internal server error.');
		} else {
			response.redirect('/');
		}
	});
}

app.get('/', function (request, response) {
	listImages(response);
});

app.use(bodyParser.urlencoded({
  extended: true
}));

var options = {
    renderDelay: 100,
};

app.post('/upload', async function (request, response) {

	let domain = (new URL(request.body.url));
	domain = domain.hostname.replace("www.","").replace(".com","") + uuid.v4();

	const browser = await puppeteer.launch();
 	const page = await browser.newPage();
  	await page.goto(request.body.url);
	await page.screenshot({path: domain + ".png"});

	var image = fs.readFileSync(domain+ ".png");
    var s3 = new AWS.S3({ params: { Bucket: bucket, Key: domain+".png"} });
    s3.upload({ Body: image }, function(err, data) {
        if(err) return console.log(err);
		else response.redirect("/");
    });
});
 
app.listen(8080);

console.log('Server started. Open http://localhost:8080 with browser.');