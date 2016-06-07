var Yelp = require('yelp');
var yelp = new Yelp({
	consumer_key: process.env.YELP_CONSUMER_KEY,
	consumer_secret: process.env.YELP_CONSUMER_SECRET,
	token: process.env.YELP_TOKEN,
	token_secret: process.env.YELP_TOKEN_SECRET
});

// This returns a promise
function searchFunc(term) {
	return yelp.search(term).then(function(data) {
		// console.log(data);
		return data;
	}, function(error) {
		console.log(error);
	});
}

function businessesFunc(id) {
	return yelp.business(id).then(function(data) {
		return data;
	}, function(error) {
		console.log(error);
	});
}

module.exports = {
	"search": searchFunc,
	"businesses" : businessesFunc
};
