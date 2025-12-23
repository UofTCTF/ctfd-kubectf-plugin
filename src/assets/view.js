CTFd.plugin.run((_CTFd) => {
    const $ = _CTFd.lib.$;


CTFd._internal.challenge.data = undefined

CTFd._internal.challenge.renderer = null;
//CTFd._internal.challenge.renderer = CTFd.lib.markdown();

CTFd._internal.challenge.preRender = function () { }

CTFd._internal.challenge.render = function (markdown) {
    return CTFd._internal.challenge.renderer.render(markdown)
}

function waitForElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
        callback(element);
    } else {
        requestAnimationFrame(() => waitForElement(selector, callback));
    }
}

CTFd._internal.challenge.postRender = function () {
    waitForElement(".create-chal", (btn) => {
        btn.addEventListener("click", () => createDeployment(btn));
    });
    waitForElement(".extend-chal", (btn) => {
        btn.addEventListener("click", () => extendDeployment(btn));
    });
    waitForElement(".terminate-chal", (btn) => {
        btn.addEventListener("click", () => terminateDeployment(btn));
    });
    getDeployment(CTFd._internal.challenge.template_name);
    console.log(CTFd.lib.$('#challenge-id').val())
}

CTFd._internal.challenge.submit = function (preview) {
    var challenge_id = parseInt(CTFd.lib.$('#challenge-id').val())
    var submission = CTFd.lib.$('#challenge-input').val()

    var body = {
        'challenge_id': challenge_id,
        'submission': submission,
    }
    var params = {}
    if (preview) {
        params['preview'] = true
    }

    return CTFd.api.post_challenge_attempt(params, body).then(function (response) {
        if (response.status === 429) {
            // User was ratelimited but process response
            return response
        }
        if (response.status === 403) {
            // User is not logged in or CTF is paused.
            return response
        }
        return response
    })
};

function toggleLoading(btn) {
    var icon = btn.querySelector('i');
    btn.disabled = !btn.disabled;
    icon.classList.toggle('fa-spin');
    icon.classList.toggle('fa-spinner');
}


function toggleChallengeCreate() {
    let btn = $(".create-chal").first();
    btn.toggleClass('d-none');
    console.log(btn);
}

function toggleChallengeUpdate() {
    let btn = $(".extend-chal").first();
    btn.toggleClass('d-none');

    btn = $(".terminate-chal").first();
    btn.toggleClass('d-none');
}

function calculateExpiry(date) {
    // Get the difference in minutes
    let difference = Math.floor((date - Date.now()) / (1000 * 60));
    return difference;
}

function createChallengeLinkElement(data, parent) {
    let expiry = calculateExpiry(new Date(data.deployment.expires));

    if (expiry > 0) {
        var expires = document.createElement('span');
        expires.textContent = "Expires in " + calculateExpiry(new Date(data.deployment.expires)) + " minutes.";

        // TODO: remove this jank and have a proper way to determine how to connect to chals
        parent.append(expires);
        parent.append(document.createElement('br'));
        if (data.deployment.host.includes("pwn")) {
            var conn_string = document.createElement('span');
            conn_string.textContent = `openssl s_client -quiet -connect ${data.deployment.host}:443`
            parent.append(conn_string);

        } else {
            let link = document.createElement('a');
            link.href = 'https://' + data.deployment.host;
            link.textContent = data.deployment.host;
            link.target = '_blank'
            parent.append(link);
        }

        // Add admin bot link if challenge is tagged with bot
        const chalTag = CTFd.lib.$(".challenge-tag").last().text();
        if (chalTag.startsWith("#")) {
            parent.append(document.createElement("br"))
            let link = document.createElement('a');
            const subdomains = new URL(`https://${data.deployment.host}`).hostname.split('.')
            const unique = `${subdomains.shift(1)}-${chalTag.substring(1)}`;
            const host = `https://${unique}.${subdomains.join('.')}`
            link.href =  host;
            link.target = '_blank'
            link.textContent = host;
            parent.append(link);
        }
        
    } 
}

function awaitChallengeReady(data) {
    
}

function getDeployment(deployment) {
    waitForElement(".alert", (alert) => {
        CTFd.fetch("api/kube_ctf/" + deployment, {
            method: "GET",
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                createChallengeLinkElement(data, alert);
                toggleChallengeUpdate();
            } else {
                alert.textContent = "Challenge not started";
                toggleChallengeCreate();
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert.textContent = "Challenge not started";
            toggleChallengeCreate();
        });
    });
}

function createDeployment(btn) {
    console.log("ive been clicked!")
    let deployment = btn.dataset.deployment;
    toggleLoading(btn);
    waitForElement(".alert", (alert) => {
        CTFd.fetch("api/kube_ctf/" + deployment, {
            method: "POST",
            body: JSON.stringify({action: "create"}),
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                createChallengeLinkElement(data, alert);
                toggleChallengeUpdate();
                toggleChallengeCreate();
                toggleLoading(btn);
            } else {
                alert.textContent = data.error || data.message;
                alert.classList.add("alert-danger")
                toggleLoading(btn);
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert.textContent = "Error creating challenge"
            alert.classList.add("alert-danger")
            toggleLoading(btn);
        });
    });
}

function extendDeployment(btn) {
    let deployment = btn.dataset.deployment;
    toggleLoading(btn);
    waitForElement(".alert", (alert) => {
        CTFd.fetch("api/kube_ctf/" + deployment, {
            method: "POST",
            body: JSON.stringify({action: "extend"}),
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                createChallengeLinkElement(data, alert)
                toggleLoading(btn);
            } else {
                alert.textContent = data.error || data.message;
                alert.classList.add("alert-danger")
                toggleLoading(btn);
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert.textContent = "Error extending challenge"
            alert.classList.add("alert-danger")
            toggleLoading(btn);
        });
    });
}

// function resetDeployment() {

// }

function terminateDeployment(btn) {
    let deployment = btn.dataset.deployment;
    toggleLoading(btn);
    waitForElement(".alert", (alert) => {
        CTFd.fetch("api/kube_ctf/" + deployment, {
            method: "POST",
            body: JSON.stringify({action: "terminate"}),
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                alert.textContent = "Challenge Terminated."
                toggleChallengeCreate();
                toggleChallengeUpdate();
                toggleLoading(btn);
            } else {
                alert.textContent = data.error || data.message;
                alert.classList.add("alert-danger")
                toggleLoading(btn);
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert.textContent = "Error terminating challenge";
            alert.classList.add("alert-danger")
            toggleLoading(btn);
        });
    });
}
});
