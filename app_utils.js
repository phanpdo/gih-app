async function postServer(path, params) {
    // Make the POST request using the fetch API
    return fetch(`https://localhost:${port}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json', // Adjust the content type based on your API requirements
            // Additional headers if needed
        },
        body: JSON.stringify(params), // Convert data to JSON string
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json(); // Assuming the response is in JSON format
        })
        .catch(error => {
            // Handle errors
            console.error('Error:', error);
        });
}

async function getLocalTournamentId() {
    let response = await postServer('/getLocalTournamentId', {});
    return response && response.message;
}

function createSelectOptions(values, selectElement){
    selectElement.innerHTML = '';
    values.forEach((value, i) => {
        const option = document.createElement('option');
        if (i === 0) {
            option.selected = true;
        }
        option.value = value.value;
        option.textContent = value.label;
        selectElement.appendChild(option);
    });
    return selectElement;
}

async function listCameraDevices(cameraDeviceEl) {
    return navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const cameras = devices.filter(device => device.kind === 'videoinput');

            if (cameras.length > 0) {
                console.log('Available Cameras:');
                cameras.forEach(camera => {
                    console.log(`- ${camera.label || 'Camera'} (${camera.deviceId})`);
                });
            } else {
                console.log('No cameras found.');
            }
            return cameras;
        })
        .catch(error => {
            console.error('Error enumerating devices:', error);
        });
}

function toggleShow(className, isShow) {
    let els = document.getElementsByClassName(className);
    for (let el of els) {
        el.style.display = isShow ? 'block' : 'none';
    }
}

function initSSE(receive) {
    let url = `${master_url}/local_server_sse?id=${station.station}`
    console.log('Init sse url: ', url);
    const source = new EventSource(url);
    source.addEventListener('error', function (event) {
        // Handle the error here
        console.error('EventSource error:', event);
        receive && receive(duplicate_station_error);
    });
    source.onmessage = (event) => {
        const { data } = event;
        if (data.startsWith('graphql=')) {
            let isOnline = event.data.includes('online');
            if (isOnline !== localServer.is_graphql_online) {
                setLocalServer && setLocalServer({ ...localServer, is_graphql_online: isOnline });
            }
        } else {
            try {
                let message = JSON.parse(data);
                if (message.to === station.station) {
                    receive && receive(message);
                }
            } catch (e) {
                console.log(e);
            }
        }
    };
}

const urlParams = new URLSearchParams(window.location.search);
// Get specific parameter values
const localServerError = urlParams.get('localServerError') === 'true';
const station_type = urlParams.get('station_type');
const port = urlParams.get('port');
const master_url = urlParams.get('master_url');
let station;