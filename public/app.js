var webrtc = new SimpleWebRTC({
    // the id/element dom element that will hold "our" video
    localVideoEl: 'locaScreenContainer',
    // the id/element dom element that will hold remote videos
    remoteVideosEl: '',
    debug: true,
    url: 'https://snf-647197.vm.okeanos.grnet.gr'
});


webrtc.joinRoom('epimeleia2015');


var button = document.getElementById('screenShareButton'),
    setButton = function(bool) {
        button.innerText = bool ? 'share screen' : 'stop sharing';
    };
if (!webrtc.capabilities.screenSharing) {
    button.disabled = 'disabled';
}

setButton(true);

button.onclick = function() {
    if (webrtc.getLocalScreen()) {
        webrtc.stopScreenShare();
        setButton(true);
    } else {
        webrtc.shareScreen(function(err) {
            if (err) {
                setButton(true);
            } else {
                setButton(false);
            }
        });
    }
};

// local screen obtained
webrtc.on('localScreenAdded', function(video) {
    // video.onclick = function() {
    //     video.style.width = video.videoWidth + 'px';
    //     video.style.height = video.videoHeight + 'px';
    // };
    document.getElementById('localScreenContainer').appendChild(video);
    $('#localScreenContainer').show();
});

// local screen removed
webrtc.on('localScreenRemoved', function(video) {
    document.getElementById('localScreenContainer').removeChild(video);
    $('#localScreenContainer').hide();
    setButton(true);
});

// a peer video has been added
webrtc.on('videoAdded', function(video, peer) {
    console.log('video added', peer);
    var remotes = document.getElementById('remotesVideos');
    if (remotes) {
        var container = document.createElement('div');
        // container.className = 'videoContainer';
        container.id = 'container_' + webrtc.getDomId(peer);
        container.appendChild(video);

        // suppress contextmenu
        video.oncontextmenu = function() {
            return false;
        };

        // resize the video on click
        // video.onclick = function() {
        //     container.style.width = video.videoWidth + 'px';
        //     container.style.height = video.videoHeight + 'px';
        // };

        // show the ice connection state
        if (peer && peer.pc) {
            var connstate = document.createElement('div');
            connstate.className = 'connectionstate';
            container.appendChild(connstate);
            peer.pc.on('iceConnectionStateChange', function(event) {
                switch (peer.pc.iceConnectionState) {
                    case 'checking':
                        connstate.innerText = 'Connecting to peer...';
                        break;
                    case 'connected':
                    case 'completed': // on caller side
                        connstate.innerText = 'Connection established.';
                        break;
                    case 'disconnected':
                        connstate.innerText = 'Disconnected.';
                        break;
                    case 'failed':
                        connstate.innerText = 'Connection failed.';
                        break;
                    case 'closed':
                        connstate.innerText = 'Connection closed.';
                        break;
                }
            });
        }
        remotes.appendChild(container);
    }
});

// a peer was removed
webrtc.on('videoRemoved', function(video, peer) {
    console.log('video removed ', peer);
    var remotes = document.getElementById('remotesVideos');
    var el = document.getElementById(peer ? 'container_' + webrtc.getDomId(peer) : 'localScreenContainer');
    if (remotes && el) {
        remotes.removeChild(el);
    }
});
