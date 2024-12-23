module.exports = {
	stylesheet: [ 'style.css' ],
	// css: `body { color: tomato; }`,
	body_class: 'markdown_body',
	marked_options: {
		headerIds: false,
		smartypants: false,
	},
	pdf_options: {
		format: 'A5',
		margin: '20mm',
		printBackground: true,
	},
	stylesheet_encoding: 'utf-8',
};
