/**
 * Require needed dependencies and resources.
 */
let express = require('express');
let sassMiddleware = require('node-sass-middleware');
let dotenv = require('dotenv');
let passport = require('passport');
let passportGoogleOAuth = require('passport-google-oauth20');
let mongoose = require('mongoose');
let path = require('path');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');
let app = express();

let User = require('./models/User');

/**
 * Environment variables
 */
dotenv.config();

/**
 * Connect to database
 */
let connectionString = 'mongodb://'
    + process.env.DATABASE_USER + ':'
    + process.env.DATABASE_PASSWORD + '@'
    + process.env.DATABASE_HOST + ':'
    + process.env.DATABASE_PORT + '/'
    + process.env.DATABASE_NAME + '?authSource='
    + process.env.DATABASE_NAME;

console.log('Connecting via ' + connectionString);
let promise = mongoose.connect(connectionString);

promise.then(function () {
    console.log("Successfully connected to database.")
});

/**
 * Set templating engine to twig.
 */
app.set('view engine', 'twig');

/**
 * Configure app to use middleware.
 */
app.use(sassMiddleware({
    src: path.join(__dirname, 'assets'),
    dest: path.join(__dirname, 'public/build'),
    outputStyle: 'compressed',
    prefix: '/vendor',
}));

app.use(cookieParser());
app.use(bodyParser());
app.use(session({secret: 'keyboard cat'}));

/**
 * Authentication strategy.
 */
app.use(passport.initialize());
app.use(passport.session());

let GoogleStrategy = passportGoogleOAuth.Strategy;
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        callbackURL: "https://d3adspace.de/auth/google/callback"
    },
    function (accessToken, refreshToken, profile, callback) {
        let userPromise = User.findOne({'auth.googleId': profile.id}).exec();

        userPromise.then(function (user) {
            if (user != null) {
                return callback(null, user)
            }

            let newUser = new User({
                'auth.googleId': profile.id,
                'email': profile.email,
                'name': profile.name
            });

            userPromise = newUser.insert(function (error) {
                if (error) {
                    console.log(error);
                    return;
                }

                return callback(null, newUser);
            }).exec()
        })
    }
));

passport.serializeUser(function (user, done) {
    done(null, user.auth.googleId);
});

// used to deserialize the user
passport.deserializeUser(function (id, done) {
    User.findOne({'auth.googleId': id}, function (err, user) {
        done(err, user);
    });
});

/**
 * Expose directories and library access.
 */
app.use('/vendor', express.static(path.join(__dirname, 'public/build')));
app.use('/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/popper', express.static(path.join(__dirname, 'node_modules/popper.js/dist')));
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));

/**
 * Routing configuration.
 */
const dashboardController = require('./routes/dashboardController');
app.use('/', dashboardController);

app.get('/auth/google', passport.authenticate('google', {scope: ['profile']}));
app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/'}), function (req, res) {
    res.redirect('/');
});

/**
 * Let teh server listen for requests on a certain port.
 */
let server = app.listen(3001, function () {
    console.log('Valentine app listening on port ' + server.address().port);
});