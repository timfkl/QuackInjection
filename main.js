import "./style.css"
import firebase from "firebase/app";
import "firebase/firestore"

var firebaseConfig = {
  apiKey: "AIzaSyBJEIugVINIoA-KOE1Z-i9qjr2dhAITTco",
  authDomain: "notzoomatall.firebaseapp.com",
  projectId: "notzoomatall",
  storageBucket: "notzoomatall.appspot.com",
  messagingSenderId: "177548701484",
  appId: "1:177548701484:web:f44798d0c2c47d495c0689"
};

if(!firebase.apps.length)
{
  firebase.initializeApp(firebaseConfig);
  console.log("Possible initilisation...");
}

const storage = firebase.firestore();

const clusters = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
    },
  ],
  iceCandidatePoolSize: 10,
};

let connections = new RTCPeerConnection(clusters);

let userVidStream = null;
let audienceVidStream = null;

const activateWebcam = document.getElementById('activateWebcam');
const userVid = document.getElementById('userVid');
const call = document.getElementById('call');
const callID = document.getElementById('callID');
const answerCall = document.getElementById('answerCall');
const audienceVid = document.getElementById('audienceVid');
const hangupCall = document.getElementById('hangupCall');

activateWebcam.onclick = async () => {
  userVidStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  audienceVidStream = new MediaStream();

  userVidStream.getTracks().forEach((track) => {
    connections.addTrack(track, userVidStream);
  });

  connections.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      audienceVidStream.addTrack(track);
    });
  };

  userVid.srcObject = userVidStream;
  audienceVid.srcObject = audienceVidStream;

  call.disabled = false;
  answerCall.disabled = false;
  activateWebcam.disabled = true;
};

call.onclick = async () => {
  const callDoc = storage.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callID.value = callDoc.id;

  connections.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  const offerDescription = await connections.createOffer();
  await connections.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!connections.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      connections.setRemoteDescription(answerDescription);
    }
  });

  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        connections.addIceCandidate(candidate);
      }
    });
  });

  hangupCall.disabled = false;
};

answerCall.onclick = async () => {
  const callId = callInput.value;
  const callDoc = storage.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  connections.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await connections.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await connections.createAnswer();
  await connections.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        connections.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};