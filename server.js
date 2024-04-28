const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
app.use(cors());
const { body, validationResult, oneOf } = require('express-validator');
const { Pool } = require('pg');
const { cp } = require('fs');
const { lookup } = require('dns');
app.use(express.json());
const PORT = process.env.PORT || 8080;
const pool = new Pool();

app.get('/', (req, res) => {
	res.json('Welcome to List Of Countries API');
});

const visitedValidation = (req, res, next) => {
	const { visited, sort } = req.query;
	if (
		((visited && (visited === 'true' || visited === 'false')) || !visited) &&
		((sort && (sort === 'true' || sort === 'false')) || !sort)
	) {
		next();
	} else {
		res.status(400).send('please use boolean values');
	}
};
// To get the list of all countries
app.get('/countries', visitedValidation, (req, res) => {
	let query = 'SELECT * FROM countries ';
	const { sort, visited } = req.query;
	let queryParams = [];
	if (visited) {
		query += 'WHERE visited = $1';
		queryParams.push(visited);
	}
	if (sort === 'true') query += 'ORDER BY country_name ASC';

	pool
		.query(query, queryParams)
		.then((data) => res.json(data.rows))
		.catch((err) => {
			console.error('Error fetching countries:', err);
			res.status(500).send('Error fetching countries');
		});
});

// check the country if already exists
const findCountry = (req, res, next) => {
	const { alpha_2_code, alpha_3_code } = req.body;
	pool
		.query(
			'SELECT * FROM countries WHERE alpha_2_code =$1 AND alpha_3_code =$2',
			[alpha_2_code, alpha_3_code]
		)
		.then((country) => {
			console.log(country.rows.length);
			if (country.rows.length > 0) {
				res.status(400).send('this country already exists in the list');
			} else {
				next();
			}
		})
		.catch((err) => res.status(500).send('Something went wrong'));
};

// to check if country doesent exists
const isCountryExists = (req, res, next) => {
	const { alphaCode } = req.params;
	pool
		.query('SELECT * FROM countries WHERE alpha_2_code=$1 OR alpha_3_code=$1', [
			alphaCode,
		])
		.then((country) => {
			if (country.rows.length === 0) {
				res.status(404).send('Country doesnt exists in the list');
			} else {
				next();
			}
		})
		.catch((err) => {
			console.error('Error fetching countries:', err);
			res.status(500).send('Error fetching countries');
		});
};

// to POST new countries with express validator which checks empty input fields.
app.post(
	'/countries',
	findCountry,
	body('alpha_2_code').notEmpty(),
	body('alpha_3_code').notEmpty(),
	body('visited').notEmpty(),
	(req, res) => {
		const { country_name, alpha_2_code, alpha_3_code, visited } = req.body;
		const result = validationResult(req);
		if (result.isEmpty()) {
			console.log(result);

			pool
				.query(
					'INSERT INTO countries(country_name, alpha_2_code, alpha_3_code, visited) VALUES( $1, $2, $3, $4) returning *',
					[country_name, alpha_2_code, alpha_3_code, visited]
				)
				.then((data) => res.json(data.rows).status(200))
				.catch((err) => res.sendStatus(500).send('Something went wrong'));
		} else {
			res.status(400).send('Enter all the fields');
		}
	}
);

// To get the specific contry with code
app.get('/countries/:alphaCode', isCountryExists, (req, res) => {
	const { alphaCode } = req.params;
	pool
		.query(
			'SELECT * FROM countries WHERE alpha_2_code=$1 OR alpha_3_code=$1 ',
			[alphaCode]
		)
		.then((data) => res.json(data.rows))
		.catch((err) => {
			console.error('Error fetching countries:', err);
			res.status(500).send('Error fetching countries');
		});
});

// To allow edit on countries that already exists
app.put(
	'/countries/:alphaCode',
	isCountryExists,
	body('country_name').notEmpty(),
	body('alpha_2_code').notEmpty(),
	body('alpha_3_code').notEmpty(),
	body('visited').notEmpty(),
	(req, res) => {
		const { alphaCode } = req.params;
		const { country_name, alpha_2_code, alpha_3_code, visited } = req.body;
		const result = validationResult(req);
		if (result.isEmpty()) {
			console.log(result);

			pool
				.query(
					'UPDATE countries SET country_name = $2, alpha_2_code =$3, alpha_3_code =$4, visited=$5 WHERE alpha_2_code=$1 OR alpha_3_code=$1 ',
					[alphaCode, country_name, alpha_2_code, alpha_3_code, visited]
				)
				.then(() => {
					res.status(200).send('country updated successfully');
				})
				.catch((err) => {
					console.error('Error fetching countries:', err);
					res.status(500).send('Error fetching countries');
				});
		} else {
			res.status(400).send('Enter all the fields');
		}
	}
);

// To delete entry / country
app.delete('/countries/:alphaCode', isCountryExists, (req, res) => {
	const { alphaCode } = req.params;
	pool
		.query(
			'UPDATE countries SET visited =true WHERE alpha_2_code=$1 OR alpha_3_code=$1',
			[alphaCode]
		)
		.then((country) => res.send(country.rows))
		.catch((err) => {
			console.error('Error fetching countries:', err);
			res.status(500).send('Error fetching countries');
		});
});

app.listen(PORT, () => {
	console.log(`listening on PORT http://localhost:${PORT}`);
});
