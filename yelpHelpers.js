var Yelp = require('yelp');
var yelp = new Yelp({
	consumer_key: process.env.YELP_CONSUMER_KEY,
	consumer_secret: process.env.YELP_CONSUMER_SECRET,
	token: process.env.YELP_TOKEN,
	token_secret: process.env.YELP_TOKEN_SECRET
});

function testFunc() {
	yelp.search({ term: "food", location: "Palo Alto" }).then(function(data) {
		console.log(data);
	});
}

module.exports = testFunc;