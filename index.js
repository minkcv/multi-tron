var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var Game = function(){
    this.player1name;
    this.player2name;
    this.inprogress = false;
    this.winner;
    this.x1;
    this.y1;
    this.x2;
    this.y2 ;
    this.dir1;
    this.dir2;
    this.blocks;
    this.blocks_w = 60;
    this.blocks_h = 60;
    this.gamedata = {x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2, blocks: this.blocks};

}

Game.prototype.init = function(){
    this.winner = 0;
    this.inprogress = true;
    this.x1 = 10;
    this.y1 = 10;
    this.x2 = 50;
    this.y2 = 50;
    this.dir1 = 2;
    this.dir2 = 0;
    this.blocks = new Array(this.blocks_w);
    for(var i = 0; i < this.blocks_w; i++){
        this.blocks[i] = new Array(this.blocks_h);
        for(var j = 0; j < this.blocks_w; j++){
            this.blocks[i][j] = 0;
        }
    }
    console.log("initialized game with players " + this.player1name + " and " + this.player2name);
}//end Game.init()

Game.prototype.update = function(delta){
    if(this.winner != 0){
        this.inprogress = false;
        io.sockets.in(this.player1name).emit('game state', 2);
        if(this.winner == 1){
            io.sockets.in(this.player1name).emit('winner', this.player1name);
            io.sockets.in(this.player2name).emit('winner', this.player1name);
        }
        else if(this.winner == 2){
            io.sockets.in(this.player1name).emit('winner', this.player2name);
            io.sockets.in(this.player2name).emit('winner', this.player2name);
        }else{
            io.sockets.in(this.player1name).emit('winner', 'tie');
            io.sockets.in(this.player2name).emit('winner', 'tie');
        }
        io.sockets.in(this.player2name).emit('game state', 2);
        this.player1name = undefined;
        this.player2name = undefined;
        return;
    }
    if(this.x1 < 0 || this.x1 > this.blocks_w - 1 || this.y1 < 0 || this.y1 > this.blocks_h - 1 || this.blocks[this.x1][this.y1] > 0){
        this.winner = 2;
    }
    if(this.x2 < 0 || this.x2 > this.blocks_w - 1 || this.y2 < 0 || this.y2 > this.blocks_h - 1 || this.blocks[this.x2][this.y2] > 0){
        this.winner = 1;
    }
    if(this.x1 == this.x2 && this.y1 == this.y2){ //tie
        this.winner = 3;
    }

    if(this.winner > 0)
        return;

    this.blocks[this.x1][this.y1] = 1;
    this.blocks[this.x2][this.y2] = 2;
    
    if(this.dir1 == 0){
        this.y1 -= 1;
    }else if(this.dir1 == 1){
        this.x1 += 1;
    }else if(this.dir1 == 2){
        this.y1 += 1;
    }else if(this.dir1 == 3){
        this.x1 -= 1;
    }

    if(this.dir2 == 0){
        this.y2 -= 1;
    }else if(this.dir2 == 1){
        this.x2 += 1;
    }else if(this.dir2 == 2){
        this.y2 += 1;
    }else if(this.dir2 == 3){
        this.x2 -= 1;
    }
    this.gamedata = {x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2, blocks: this.blocks};
    io.sockets.in(this.player1name).emit('game data', this.gamedata);
    io.sockets.in(this.player2name).emit('game data', this.gamedata);
}//end Game.update()

var max_games = 10;
var games = new Array(max_games);
for(var i = 0; i < max_games; i++){
    games[i] = new Game();
}

var sanitizeString = function(str){
    str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
    return str.trim();
}

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
    socket.on('direction', function(direction){
        var p1 = false;
        var p2 = false;
        var gameindex = -1;
        for(var i = 0; i < max_games; i++){
            if(games[i].player1name && games[i].player1name == socket.rooms[1]){
                p1 = true;
                gameindex = i;
                break;
            }
            else if(games[i].player2name && games[i].player2name == socket.rooms[1]){
                p2 = true;
                gameindex = i;
                break;
            }
        }
        if(gameindex != -1){
            if(p1){
                if(direction != games[gameindex].dir1)
                games[gameindex].dir1 = direction;
            }else if(p2){
                games[gameindex].dir2 = direction;
            }
        }
    });

    socket.on('join', function(username){
        username = sanitizeString(username);
        if(username == "tie")
            username = "not a 1337 hacker";
        var opengameindex = -1;
        var halfgameindex = -1;
        for(var i = 0; i < max_games; i++){
            if(! games[i].player1name){
                opengameindex = i;
                break;
            }
        }
        for(var i = 0; i < max_games; i++){
            if(games[i].player1name && ! games[i].player2name){
                halfgameindex = i;
                break;
            }
        }
        if(halfgameindex == -1 && opengameindex == -1){
            socket.emit('join response', "no available games");
            return;
        }
        var username_available = true;
        for(var i = 0; i < max_games; i++){
            if(username == games[i].player1name || username == games[i].player2name){
                username_available = false;
            }
        }
        if(username_available){
            socket.join(username);
            if(halfgameindex != -1){
                io.sockets.in(username).emit('join response', "welcome player 2");
                games[halfgameindex].player2name = username;
                console.log(username + " joined game: " + halfgameindex);
                games[halfgameindex].init();
                io.sockets.in(games[halfgameindex].player1name).emit('game state', 1);
                io.sockets.in(games[halfgameindex].player2name).emit('game state', 1);
            }else if(opengameindex != -1){
                io.sockets.in(username).emit('join response', "welcome player 1");
                console.log(username + " joined game: " + opengameindex);
                games[opengameindex].player1name = username;
            }
        }else{
            socket.emit('join response', "username already taken");
        }
    });
});

http.listen(3001, function(){
	console.log('listening on *:3001');
    var then = Date.now();
    setInterval(function(){
        var now = Date.now();
        var delta = now - then;
        for(var i = 0; i < max_games; i++){
            if(games[i] && games[i].inprogress)
                games[i].update(delta);
        }
        then = now;
    }, 100);
});

