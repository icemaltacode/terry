let chosenAssistant = 'assistant';
let sendButton = null;
let inputField = null;
let outputDiv = null;
let conversation_thread = null;

window.addEventListener('load', () => {
    handleTheme();
    loadView('a3', bindAssistantSelection);
});

// window.addEventListener('resize', function () {
//     console.log(bootstrapDetectBreakpoint());
// });

function handleTheme() {
    // Determine default preference
    const userPrefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute(
        'data-bs-theme',
        userPrefersDark ? 'dark' : 'light'
    );

    // See if there is a saved preference, otherwise set default preference
    const savedTheme = localStorage.getItem('theme');
    const theme =
        savedTheme === 'light' || savedTheme === 'dark'
            ? savedTheme
            : userPrefersDark
            ? 'dark'
            : 'light';

    document.body.setAttribute('data-bs-theme', theme);

    // Handle theme switch button
    document
        .getElementById('themeToggleBtn')
        .addEventListener('click', function () {
            const icon = document
                .getElementById('themeToggleBtn')
                .querySelector('i');
            const iconName = [...icon.classList]
                .find((cls) => cls.startsWith('bi-'))
                .replace('bi-', '');

            if (iconName === 'sun') {
                document.body.setAttribute('data-bs-theme', 'light');
                icon.classList.remove('bi-sun');
                icon.classList.add('bi-moon');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.setAttribute('data-bs-theme', 'dark');
                icon.classList.remove('bi-moon');
                icon.classList.add('bi-sun');
                localStorage.setItem('theme', 'dark');
            }
        });
}

function loadView(view, cb) {
    fetch(`partials/${view}.html`)
        .then((response) => response.text())
        .then((data) => {
            document.getElementById('main-content').innerHTML = data;
            cb();
        })
        .catch((error) => console.error('Error fetching the HTML:', error));
}

function bindAssistantSelection() {
    document.querySelector('#hero').style.display = 'block';
    document.querySelectorAll('#main-content a').forEach((link) => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            chosenAssistant = new URL(this.href).hash.substring(1);
            loadView('form', bindForm);
        });
    });
}

function bindForm() {
    // Bootstrap validation
    // Example starter JavaScript for disabling form submissions if there are invalid fields
    (function () {
        'use strict';

        // Fetch all the forms we want to apply custom Bootstrap validation styles to
        var forms = document.querySelectorAll('.needs-validation');

        // Loop over them and prevent submission
        Array.prototype.slice.call(forms).forEach(function (form) {
            form.addEventListener(
                'submit',
                function (event) {
                    if (!form.checkValidity()) {
                        event.preventDefault();
                        event.stopPropagation();
                    }

                    form.classList.add('was-validated');
                },
                false
            );
        });
    })();

    // Hide hero
    document.querySelector('#hero').style.display = 'none';

    // Restart with new assistant
    document
        .querySelector('#startover')
        .addEventListener('click', function (event) {
            event.preventDefault();
            let warningModal = new bootstrap.Modal(
                document.getElementById('warningModal')
            );
            warningModal.show();
            document
                .getElementById('confirmYes')
                .addEventListener('click', function () {
                    warningModal.hide();
                    loadView('a3', bindAssistantSelection);
                });
        });

    // Generate the prompt
    document
        .querySelector("button[type='submit']")
        .addEventListener('click', function (event) {
            const form = document.querySelector('#promptForm');

            if (!form.checkValidity()) {
                form.reportValidity(); // Show validation messages
                return; // Stop execution if the form is invalid
            }

            event.preventDefault(); // Prevent form submission if valid

            // Show modal
            let promptModal = new bootstrap.Modal(
                document.getElementById('promptModal')
            );
            generatePrompt();
            promptModal.show();
        });

    // Copy to clipboard functionality
    document
        .getElementById('copyPrompt')
        .addEventListener('click', function () {
            let promptText = document.getElementById('promptText');
            promptText.select();
            navigator.clipboard
                .writeText(promptText.value)
                .then(() => {
                    let copyButton = document.getElementById('copyPrompt');
                    let icon = copyButton.querySelector('i');
                    copyButton.classList.remove('btn-primary');
                    copyButton.classList.add('btn-success');
                    icon.classList.remove('bi-clipboard');
                    icon.classList.add('bi-clipboard-check');
                    setTimeout(() => {
                        copyButton.classList.remove('btn-success');
                        copyButton.classList.add('btn-primary');
                        if (icon) {
                            icon.classList.remove('bi-clipboard-check');
                            icon.classList.add('bi-clipboard');
                        }
                    }, 5000);
                })
                .catch((err) => {
                    console.error('Failed to copy: ', err);
                    alert(
                        'Your browser does not support copying to clipboard. Please copy the text manually.'
                    );
                });
        });

    // Send messages to terry
    sendButton = document.getElementById('sendMessage');
    inputField = document.getElementById('terryInput');
    outputDiv = document.getElementById('terryOutput');

    // Attach event listener to the Send button
    sendButton.addEventListener('click', sendMessage);

    // Allow sending messages with Enter key
    inputField.addEventListener('keypress', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    // Automatically send messages on form field input
    document
        .querySelectorAll('#promptForm input, textarea')
        .forEach((element) => {
            element.addEventListener('blur', function (event) {
                content = this.value.trim();
                if (content !== '') {
                    id = this.id;
                    message = `Evaluate whether ${content} is a good value for the ${id} placeholder.`;
                    sendMessage(message);
                }
            });
        });

    // Evaluate whole prompt
    evaluatePrompt.addEventListener('click', evaluateWholePrompt);

    // Hide notification dot when sidebar opened
    const sidebarToggle = document.querySelector('.floating-toggle-btn');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const dot = document.getElementById('notificationDot');
            dot.classList.add('d-none');
            dot.classList.remove('pulse-dot');
        });
    }
}

async function sendMessage(message) {
    // Get message from input field or parameter
    const userMessage = message || inputField.value.trim();
    if (!userMessage) return; // Prevent sending empty messages

    // Disable input and button while waiting for response
    document.getElementById('sendMessage').disabled = true;
    document.getElementById('terryInput').disabled = true;

    // Show the user's own message if typed
    if (!message) {
        outputDiv.innerHTML += `<div class="text-primary user-bubble"><strong>You:</strong> ${userMessage}</div><br>`;
    }
    inputField.value = '';

    // Show loading spinner
    outputDiv.innerHTML +=
        "<img class='loading-img' src='/assets/loading_light.gif'>";

    // Send request to backend proxy
    try {
        const response = await fetch('http://127.0.0.1:3000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userMessage: userMessage,
                threadId: conversation_thread
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let receivedText = '';
        outputDiv.innerHTML += `<div class="text-secondary terry-bubble"><strong>Terry:</strong></div>`;
        let assistantOutputDiv = document.createElement('div');
        assistantOutputDiv.classList.add('terry-bubble', 'text-secondary', 'terry-words');
        outputDiv.appendChild(assistantOutputDiv);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true }).trim();

            // Split in case multiple JSON objects arrive in a single chunk
            const lines = chunk.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('data:')) {
                    const jsonString = line.replace(/^data:\s*/, '');
                    try {
                        const parsedData = JSON.parse(jsonString);
                        if (parsedData.text && parsedData.text.trim() !== '') {
                            receivedText += parsedData.text;
                            assistantOutputDiv.innerHTML = `<p>${marked.parse(
                                receivedText
                            )}</p>`;
                            outputDiv.scrollTop = outputDiv.scrollHeight; // Scroll to bottom
                        }
                        if (parsedData.threadId) {
                            conversation_thread = parsedData.threadId; // Store threadId for follow-up messages
                        }
                    } catch (error) {
                        console.error(
                            'Error parsing JSON:',
                            error,
                            'Chunk:',
                            jsonString
                        );
                    }
                }
            }

            // Show the notification dot when the sidebar is collapsed.
            const sidebar = document.getElementById('sidebar');
            const isCollapsed = !sidebar.classList.contains('show');
            if (isCollapsed) {
                const dot = document.getElementById('notificationDot');
                dot.classList.remove('d-none');
                dot.classList.add('pulse-dot');
            }
        }
    } catch (error) {
        console.error('Error in streaming:', error);
        document.getElementById('terryOutput').innerHTML +=
            '<p><em>Error retrieving response.</em></p>';
    } finally {
        // Re-enable input and button after response
        document.getElementById('sendMessage').disabled = false;
        document.getElementById('terryInput').disabled = false;

        // Hide loading spinner
        document.querySelector('.loading-img').remove();
    }
}

async function generatePrompt(display = true) {
    try {
        // Load the base persona prompt
        let response = await fetch('data/a3.json');
        let jsonData = await response.json();
        let prompt = jsonData.find(
            (item) => item.name === chosenAssistant
        ).prompt;

        // Load the C3 prompt
        response = await fetch('data/c3.json');
        jsonData = await response.json();
        prompt += jsonData.find((item) => item.name === 'main').prompt;

        // Get user input
        let formData = {};
        document
            .querySelectorAll('form input, form textarea')
            .forEach((input) => {
                formData[input.id] = input.value.trim(); // Store values in object
            });

        // Inject user input
        // Replace placeholders with user input
        Object.keys(formData).forEach((key) => {
            const placeholder = `⟨${key}⟩`;
            prompt = prompt.replaceAll(placeholder, formData[key] || '');
        });

        // Additional logic that should run after fetch completes
        if (display) {
            document.getElementById('promptText').value = prompt;
        }
        return prompt;
    } catch (error) {
        console.error('Error loading JSON:', error);
    }
}

async function evaluateWholePrompt() {
    prompt = await generatePrompt(false);
    sendMessage(`This is the prompt so far. Please evaluate it: ${prompt}`);
}
