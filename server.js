const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uri = process.env.DB_URI;
const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

connectToDatabase();

app.post('/submit-survey/:surveyNumber', async (req, res) => {
    try {
        const surveyNumber = req.params.surveyNumber;
        const surveyData = req.body;
        const database = client.db('survey_database');
        const surveys = database.collection(`surveys${surveyNumber}`);

        await surveys.insertOne(surveyData);

        res.json({ success: true });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ error: 'An error occurred while submitting the survey' });
    }
});

app.get('/survey-results/:surveyNumber', async (req, res) => {
    try {
        const surveyNumber = req.params.surveyNumber;
        const database = client.db('survey_database');
        const surveys = database.collection(`surveys${surveyNumber}`);

        const pipeline = (surveyNumber === '5')
            ? [
                {
                    $group: {
                        _id: null,
                        bankiDual: { $push: '$bankiDual' },
                        bankiRobot: { $push: '$bankiRobot' },
                        byteBetyarok: { $push: '$byteBetyarok' },
                        talkReader: { $push: '$talkReader' },
                        telePoci: { $push: '$telePoci' },
                        pihenTECH: { $push: '$pihenTECH' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        bankiDual: 1,
                        bankiRobot: 1,
                        byteBetyarok: 1,
                        talkReader: 1,
                        telePoci: 1,
                        pihenTECH: 1
                    }
                }
            ]
            : [
                {
                    $group: {
                        _id: null,
                        satisfaction1: { $push: '$satisfaction1' },
                        satisfaction2: { $push: '$satisfaction2' },
                        satisfaction3: { $push: '$satisfaction3' },
                        favoriteTalk: { $push: '$favoriteTalk' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        satisfaction1: 1,
                        satisfaction2: 1,
                        satisfaction3: 1,
                        favoriteTalk: 1
                    }
                }
            ];

        const [aggregateResults, opinions] = await Promise.all([
            surveys.aggregate(pipeline).toArray(),
            surveys.find({opinion: {$exists: true, $ne: ""}}, {projection: {_id: 0, opinion: 1}}).toArray()
        ]);

        const results = aggregateResults[0] || (surveyNumber === '5'
            ? { bankiDual: [], bankiRobot: [], byteBetyarok: [], talkReader: [], telePoci: [], pihenTECH: [] }
            : { satisfaction1: [], satisfaction2: [], satisfaction3: [], favoriteTalk: [] }
        );
        results.opinions = (surveyNumber === '5') ? [] : opinions.map(doc => doc.opinion);

        res.json(results);
    } catch (error) {
        console.error('Error fetching survey results:', error);
        res.status(500).json({ error: 'An error occurred while fetching survey results' });
    }
});

for (let i = 1; i <= 7; i++) {
    app.get(`/results${i}`, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', `results${i}.html`));
    });
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
