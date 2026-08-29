(() => {
  const form = document.getElementById('mc-terminal-form');
  const input = document.getElementById('mc-terminal-input');
  const output = document.getElementById('mc-terminal-output');

  if (!form || !input || !output) return;

  const projectLinks = [
    { label: 'The Daily Fetch', href: '/play/daily-fetch/' },
    { label: 'Home Maintenance Tracker', href: 'https://github.com/mcornelia/home-maintenance-tracker', external: true },
    { label: 'Mountain Mesh Setup Guide', href: 'https://mcornelia.github.io/mountain-mesh-node-guide', external: true },
    { label: 'Family AI ChatBot', href: '/posts/family-ai-chatbot.html' }
  ];

  const gameLinks = [
    { label: 'The Daily Fetch', href: '/play/daily-fetch/' },
    { label: 'Retro Arcade', href: '/play.html' },
    { label: 'Rack Invaders', href: '/play/rack-invaders.html' }
  ];

  const randomLinks = [
    ...projectLinks,
    ...gameLinks.slice(1),
    { label: 'Room Layout Tool', href: 'https://mcornelia.github.io/room-layout-tool', external: true },
    { label: 'About the human', href: '/about.html' }
  ];

  const dogReports = [
    'Olive is running ball-recovery operations. Huck is the watchdog. Olive would like it noted that she is also his manager.',
    'Huck reports that the perimeter is secure. Olive reports that this meeting could have been a ball throw.',
    'Current lab hierarchy: Olive manages. Huck watches. The humans provide snacks and technical support.',
    'Olive has classified the orange-and-blue ball as mission critical. Huck has no objections.'
  ];

  const history = [];
  let historyIndex = 0;

  function makeResponse(text, links = []) {
    return { text: Array.isArray(text) ? text : [text], links };
  }

  const commands = {
    help: () => makeResponse(
      'Available commands: help, projects, games, radio, dogs, random, about, contact, clear. Arrow keys recall earlier commands.'
    ),
    projects: () => makeResponse('A few useful things currently escaping from the lab:', projectLinks),
    games: () => makeResponse('Choose your distraction:', gameLinks),
    radio: () => makeResponse(
      'Meshtastic uses small LoRa radios for long-range text messaging without cellular service or the internet.',
      [{ label: 'Open the Mountain Mesh guide', href: 'https://mcornelia.github.io/mountain-mesh-node-guide', external: true }]
    ),
    dogs: () => makeResponse(dogReports[Math.floor(Math.random() * dogReports.length)]),
    random: () => {
      const pick = randomLinks[Math.floor(Math.random() * randomLinks.length)];
      return makeResponse(`The lab's highly scientific randomizer selected: ${pick.label}.`, [pick]);
    },
    about: () => makeResponse('A quieter corner with the background story.', [{ label: 'Read the About page', href: '/about.html' }]),
    contact: () => makeResponse('The signal path is open.', [{ label: 'Contact Mike', href: '/contact.html' }]),
    whoami: () => makeResponse('A curious visitor with guest access to the Lab. Root privileges remain with Olive.'),
    sudo: () => makeResponse('Permission denied. Olive has the admin password and is not sharing.'),
    fetch: () => makeResponse('Ball located. Puzzle deployment ready.', [{ label: 'Help Olive fetch it', href: '/play/daily-fetch/' }])
  };

  function addLinks(container, links) {
    if (!links.length) return;

    const nav = document.createElement('nav');
    nav.className = 'mc-terminal-links';
    nav.setAttribute('aria-label', 'Command results');

    links.forEach((link) => {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.label;
      if (link.external) {
        anchor.target = '_blank';
        anchor.rel = 'noopener';
      }
      nav.appendChild(anchor);
    });

    container.appendChild(nav);
  }

  function appendResult(command, response) {
    const entry = document.createElement('div');
    entry.className = 'mc-terminal-entry';

    const commandLine = document.createElement('p');
    commandLine.className = 'mc-terminal-command';
    commandLine.textContent = command;
    entry.appendChild(commandLine);

    response.text.forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.className = 'mc-terminal-response';
      paragraph.textContent = line;
      entry.appendChild(paragraph);
    });

    addLinks(entry, response.links);
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
  }

  function resetOutput() {
    const intro = document.createElement('p');
    intro.className = 'mc-terminal-system';
    intro.textContent = 'Screen cleared. Type help when curiosity returns.';
    output.replaceChildren(intro);
  }

  function runCommand(rawCommand) {
    const command = rawCommand.trim().toLowerCase();
    if (!command) return;

    history.push(command);
    historyIndex = history.length;

    if (command === 'clear') {
      resetOutput();
      input.value = '';
      input.focus();
      return;
    }

    const response = commands[command]
      ? commands[command]()
      : makeResponse(`Command not found: ${command}. Try help.`);

    appendResult(command, response);
    input.value = '';
    input.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runCommand(input.value);
  });

  document.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('click', () => runCommand(button.dataset.command || ''));
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    }

    if (event.key === 'ArrowDown' && history.length) {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = historyIndex === history.length ? '' : history[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    }

    if (event.key === 'Escape') {
      input.value = '';
    }
  });
})();
