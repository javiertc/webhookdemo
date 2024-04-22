require('dotenv').config();
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

//  Serve static website
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './client')));

//simulating a DB
const myDB = [
    { name: 'wallet1', address: '0x1f83ec80d755a87b31553f670070bfd897c40ce0', externalID: '0x1f83ec80d755a87b31553f670070bfd897c40ce0' },
    { name: 'wallet2', address: '0x8ae323046633A07FB162043f28Cea39FFc23B50A', externalID: '0x8ae323046633A07FB162043f28Cea39FFc23B50A' }
];

app.post('/callback', async (req, res) => {
    const { body } = req;
    try {
        res.sendStatus(200);
        handleTransaction(body.event.transaction).catch(error => {
            console.error('Error processing transaction:', error);
        });
    } catch (error) {
        console.error('Error processing transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Handle transaction
async function handleTransaction(transaction) {
    console.log('Transaction:', transaction);
    const notifications = [];

    const erc20Transfers = transaction?.erc20Transfers || [];
    for (const transfer of erc20Transfers) {
        const externalID = await getExternalID(transfer.to);
        const { symbol, valueWithDecimals } = transfer.erc20Token;
        notifications.push({
            type: transfer.type,
            sender: transfer.from,
            receiver: transfer.to,
            amount: valueWithDecimals,
            token: symbol,
            externalID
        });
    }

    if (transaction?.networkToken) {
        const { tokenSymbol, valueWithDecimals } = transaction.networkToken;
        const externalID = await getExternalID(transaction.to);
        notifications.push({
            sender: transaction.from,
            receiver: transaction.to,
            amount: valueWithDecimals,
            token: tokenSymbol,
            externalID
        });
    }

    if (notifications.length > 0) {
        sendNotifications(notifications);
    }
}

//connect to DB and return externalID
async function getExternalID(address) {
    const entry = myDB.find(entry => entry.address.toLowerCase() === address.toLowerCase());
    return entry ? entry.externalID : null;
}

// Send notifications
async function sendNotifications(notifications) {
    for (const notification of notifications) {
        try {
            const data = {
                include_aliases: { external_id: [notification.externalID.toLowerCase()] },
                target_channel: 'push',
                isAnyWeb: true,
                contents: { en: `You've received ${notification.amount} ${notification.token}` },
                headings: { en: 'Core wallet' },
                name: 'Notification',
                app_id: process.env.APP_ID
            };
            console.log('data:', data);
            const response = await axios.post('https://onesignal.com/api/v1/notifications', data, {
                headers: {
                    Authorization: `Bearer ${process.env.ONESIGNAL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Notification sent:', response.data);
        } catch (error) {
            console.error('Error sending notification:', error);
            // Optionally, implement retry logic here
        }
    }
}

// Start the server
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});