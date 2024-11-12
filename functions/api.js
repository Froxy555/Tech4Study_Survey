const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.DB_URI;
const client = new MongoClient(uri);

exports.handler = async (event, context) => {
  try {
    await client.connect();
    const database = client.db('survey_database');

    if (event.httpMethod === 'POST' && event.path.startsWith('/.netlify/functions/api/submit-survey/')) {
      const surveyNumber = event.path.split('/').pop();
      const surveys = database.collection(`surveys${surveyNumber}`);
      const surveyData = JSON.parse(event.body);
      await surveys.insertOne(surveyData);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    } else if (event.httpMethod === 'GET' && event.path.startsWith('/.netlify/functions/api/survey-results/')) {
      const surveyNumber = event.path.split('/').pop();
      const surveys = database.collection(`surveys${surveyNumber}`);
      const [aggregateResults, opinions] = await Promise.all([
        surveys.aggregate([
          {
            $group: {
              _id: null,
              satisfaction1: { $push: '$satisfaction1' },
              satisfaction2: { $push: '$satisfaction2' },
              satisfaction3: { $push: '$satisfaction3' }
            }
          },
          {
            $project: {
              _id: 0,
              satisfaction1: 1,
              satisfaction2: 1,
              satisfaction3: 1
            }
          }
        ]).toArray(),
        surveys.find({opinion: {$exists: true, $ne: ""}}, {projection: {_id: 0, opinion: 1}}).toArray()
      ]);

      const results = aggregateResults[0] || { satisfaction1: [], satisfaction2: [], satisfaction3: [] };
      results.opinions = opinions.map(doc => doc.opinion);

      return {
        statusCode: 200,
        body: JSON.stringify(results)
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An error occurred' })
    };
  } finally {
    await client.close();
  }
};
