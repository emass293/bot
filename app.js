require('dotenv-extended').load();

var restify = require('restify');
var builder = require('botbuilder');
var needle = require('needle');
var url = require('url');
var validUrl = require('valid-url');
var ocrService = require('./ocr-service');
var spellService = require('./spell-service');
// Setup Restify Server

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
/*var bot = new builder.UniversalBot(connector,    {
 localizerSettings: { 
 defaultLocale: "fr" 
 }
 });
 */
var bot = new builder.UniversalBot(connector, function (session) {
    if (hasImageAttachment(session)) {
        var stream = getImageStreamFromMessage(session.message);
        ocrService
            .getCaptionFromStream(stream)
            .then(function (caption) { handleSuccessResponse(session, caption); })
            .catch(function (error) { handleErrorResponse(session, error); });
    } else {
        var imageUrl = parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
        if (imageUrl) {
            ocrService
                .getCaptionFromUrl(imageUrl)
                .then(function (caption) { handleSuccessResponse(session, caption); })
                .catch(function (error) { handleErrorResponse(session, error); });
        } else {                  
            session.send('Désolé, je n\'ai pas compris votre demande : \'%s\'. tappez \'aide\' pour obtenir une assistance.', session.message.text);
            spellService
                .getCorrectedText('banjour')
                .then(function (text) {
                    session.send(text);
                })
                .catch(function (error) {
                    console.error(error);
                });
        }
    }
});

// Spell Check
if (process.env.IS_SPELL_CORRECTION_ENABLED === 'true') {
    bot.use({
        botbuilder: function (session, next) {
            spellService
                .getCorrectedText(session.message.text)
                .then(function (text) {
                    session.message.text = text;
                    next();
                })
                .catch(function (error) {
                    console.error(error);
                    next();
                });
        }
    });
}


var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
//var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.recognizer(recognizer);
//---------------------------------------------------------
// Dialogs
//---------------------------------------------------------
/*
 bot.dialog('/', [
 // Step 1
 function (session) {
 session.send("Bonjour je suis Camille");
 builder.Prompts.text(session, 'Quel est ton nom?');
 },
 // Step 2
 function (session, results) {
 session.endDialog('Bonjour %s!', results.response);
 }
 ]);
 
 */

//=========================================================
// Bots Events
//=========================================================

//Sends greeting message when the bot is first added to a conversation
bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                var reply = new builder.Message()
                    .address(message.address)
                    .text('Bonjour, je suis Camille l\'assistante du Caf.fr');
                bot.send(reply);
            }
        });
    }
});


var nom;
var logement;

bot.dialog('intentDemande', [
    function (session, args, next) {
        session.send('Analyse de votre demande : \'%s\'', session.message.text);

        // try extracting entities
        var domaine = builder.EntityRecognizer.findEntity(args.intent.entities, 'DomaineMetier');
        
        if (domaine) {
            
            next({response: domaine});
        } else {
            builder.Prompts.text(session, 'Pour quelle domaine ?');
        }
    },
    function (session, results) {
        domaine = results.response.resolution.values[0];
        if(domaine==='Logement'){
        var message = 'Je peux vous proposer plusieurs types d\'allocation logement. choisissez celle qui correspond à votre situation.';
        session.send(message);
        
         var msg = new builder.Message(session);
    msg.attachmentLayout(builder.AttachmentLayout.carousel)
    msg.attachments([
        new builder.HeroCard(session)
            .title("ALE")
            .subtitle("Allocation logement étudiant")
            .text("description")
            .buttons([
                builder.CardAction.imBack(session, "choix:ALE", "ALE")
            ]),
        new builder.HeroCard(session)
            .title("AL")
            .subtitle("Allocation logement")
            .text("description")
            .buttons([
                builder.CardAction.imBack(session, "choix:AL", "AL")
            ]),
        new builder.HeroCard(session)
            .title("APL")
            .subtitle("Allocation personnalisée au logement")
            .text("description")
            .buttons([
                builder.CardAction.imBack(session, "choix:APL", "APL")
            ])
    ]);
    session.endDialog(msg);
    }else {
        session.endDialog('Je ne traite pas encore les demandes associées au domaine %s, mais j\'apprend vite!',domaine);
    }
    }
]).triggerAction({
    matches: 'intentDemande'
});

bot.dialog('intentChoix', [
    function (session, args, next) {
        session.send('Analyse de votre demande : \'%s\'', session.message.text);

        // try extracting entities

        var presta = builder.EntityRecognizer.findEntity(args.intent.entities, 'PrestationsLogement');
        
        if (presta) {            
            next({response: presta});
        } else {
            builder.Prompts.text(session, 'Pour quelle prestation ?');
        }
    },
    function (session, results) {
        presta = results.response.resolution.values[0];
        session.send(presta);
        if(presta==='ALE'){
        var message = 'Voici les conditions pour obtenir l\ALE.';
       
    } else if (presta==='AL'){
        var message = 'Voici les conditions pour obtenir l\AL.';
    } else {
        var message = 'Voici les conditions pour obtenir l\APL.';
    }
    session.endDialog(message);
   
    }
]).triggerAction({
    matches: 'intentChoix'
});



var prenom='Luc';

bot.dialog('intentBonjour', 
    function (session) {
        session.endDialog('Bonjour %s, je suis Camille. Que puis-je pour vous ?', prenom);
    }
).triggerAction({
    matches: 'intentBonjour'
});
 
 
 
 
 
 
 var ouinon = {
    oui: 'Oui',
    non: 'Non'
};

 
 bot.dialog('Aide', 
 
function (session) {
     builder.Prompts.text(session, 'Pouvez-vous me fournir l\'image du docuemnt?');
    if (hasImageAttachment(session)) {
        var stream = getImageStreamFromMessage(session.message);
        ocrService
            .getCaptionFromStream(stream)
            .then(function (caption) { handleSuccessResponse(session, caption); })
            .catch(function (error) { handleErrorResponse(session, error); });
    } else {
        var imageUrl = parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
        if (imageUrl) {
            ocrService
                .getCaptionFromUrl(imageUrl)
                .then(function (caption) { handleSuccessResponse(session, caption); })
                .catch(function (error) { handleErrorResponse(session, error); });
        } else {
            session.send('Did you upload an image? I\'m more of a visual person. Try sending me an image or an image URL');
        }
}
     
/*
     builder.Prompts.choice(session,'Souhaitez-vous pré remplir votre formulaire?',
     [ouinon.oui,ouinon.non],
     {maxRetries: 3,
         retryPrompt: 'Option non valide'});
     
} ,
    function (session, results) {
         if (!results.response) {
            // exhausted attemps and no selection, start over
            session.send('Trop d\'essais');
            return session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('Erreur avec le message: %s', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        var selection = results.response.entity;
        switch (selection) {
            case '1':
                return session.endDialog('reponse 1');
            case '2':
                return session.endDialog('reponse 2');
        }
        
        if(!results.response){
            session.send('Trop d\'erreur');
            return session.endDialog();
        }
        session.endDialog('réponse : '+results.reponse.entity);

    }
    */
   
     /* caroussel
      var msg = new builder.Message(session);
    msg.attachmentLayout(builder.AttachmentLayout.carousel)
    msg.attachments([
        new builder.HeroCard(session)
            .title("Classic White T-Shirt")
            .subtitle("100% Soft and Luxurious Cotton")
            .text("Price is $25 and carried in sizes (S, M, L, and XL)")
            .images([builder.CardImage.create(session, 'https://winblogs.azureedge.net/win/2015/07/Windows_Insider_Ninjacat_Unicorn-1024x768-Desktop.png')])
            .buttons([
                builder.CardAction.imBack(session, "buy classic white t-shirt", "Buy")
            ]),
        new builder.HeroCard(session)
            .title("Classic Gray T-Shirt")
            .subtitle("100% Soft and Luxurious Cotton")
            .text("Price is $25 and carried in sizes (S, M, L, and XL)")
            .images([builder.CardImage.create(session, 'http://news.thewindowsclubco.netdna-cdn.com/wp-content/uploads/2015/03/Ninja-Cat-Unicorn-sticker.png')])
            .buttons([
                builder.CardAction.imBack(session, "buy classic gray t-shirt", "Buy")
            ])
    ]);
    session.send(msg);
    */
   /*
   var msg = new builder.Message(session);
    msg.attachmentLayout(builder.AttachmentLayout.carousel)
    msg.attachments([
        new builder.HeroCard(session)
            .text("Confirmez-vous?")
            .buttons([
                builder.CardAction.imBack(session, "Oui", "Oui"),
                builder.CardAction.imBack(session, "Non", "Non")
            ])
    ]);
    session.send(msg);
} ,
    function (session, results) {
         if (!results.response) {
            // exhausted attemps and no selection, start over
            session.send('Trop d\'essais');
            return session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('Erreur avec le message: %s', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        var selection = results.response;
        switch (selection) {
            case '1':
                return session.endDialog('reponse 1');
            case '2':
                return session.endDialog('reponse 2');
        }
        
        if(!results.response){
            session.send('Trop d\'erreur');
            return session.endDialog();
        }
        session.endDialog('réponse : '+results.reponse.entity);

    
 */  
    //session.endDialog(nom+ 'Essaye des demandes du stype \'je veux faire une demande de RSA\' ou \'Mon nouveau numéro de téléphone est xxxxxxx\'');
    }).triggerAction({
    matches: 'Aide'
});


//=========================================================
// Utilities
//=========================================================
function hasImageAttachment(session) {
    return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
}

function getImageStreamFromMessage(message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (checkRequiresToken(message)) {
        // The Skype attachment URLs are secured by JwtToken,
        // you should set the JwtToken of your bot as the authorization header for the GET request your bot initiates to fetch the image.
        // https://github.com/Microsoft/BotBuilder/issues/662
        connector.getAccessToken(function (error, token) {
            var tok = token;
            headers['Authorization'] = 'Bearer ' + token;
            headers['Content-Type'] = 'application/octet-stream';

            return needle.get(attachment.contentUrl, { headers: headers });
        });
    }

    headers['Content-Type'] = attachment.contentType;
    return needle.get(attachment.contentUrl, { headers: headers });
}

function checkRequiresToken(message) {
    return message.source === 'skype' || message.source === 'msteams';
}

/**
 * Gets the href value in an anchor element.
 * Skype transforms raw urls to html. Here we extract the href value from the url
 * @param {string} input Anchor Tag
 * @return {string} Url matched or null
 */
function parseAnchorTag(input) {
    var match = input.match('^<a href=\"([^\"]*)\">[^<]*</a>$');
    if (match && match[1]) {
        return match[1];
    }

    return null;
}

//=========================================================
// Response Handling
//=========================================================
function handleSuccessResponse(session, ocrObj) {
    var numeroAllocataire = ocrObj.regions[0].lines[2].words[3].text;
    var montant = ocrObj.regions[0].lines[3].words[3].text;
    if (ocrObj) {
        session.send('Ton numéro d\'allocataire est : ' + decodeURIComponent(escape(numeroAllocataire)));
        session.send('Le montant accordé est : ' + decodeURIComponent(escape(montant)));
        session.send('I think it\'s ' + JSON.stringify(ocrObj));
    } else {
        session.send('Couldn\'t find a caption for this one');
    }
}

function handleErrorResponse(session, error) {
    var clientErrorMessage = 'Oops! Something went wrong. Try again later.';
    if (error.message && error.message.indexOf('Access denied') > -1) {
        clientErrorMessage += "\n" + error.message;
    }

    console.error(error);
    session.send(clientErrorMessage);
}