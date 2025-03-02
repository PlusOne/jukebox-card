class JukeboxCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    set hass(hass) {
        if (!this.shadowRoot.querySelector('ha-card')) {
            this._hassObservers = [];
            this.renderStructure();
        }
        this._hass = hass;
        this._hassObservers.forEach(listener => listener(hass));
    }

    get hass() {
        return this._hass;
    }

    renderStructure() {
        this.shadowRoot.innerHTML = `
            <ha-card>
              <div id="content">
                <div id="speaker-switches" class="row"></div>
                <div id="volume-row" class="row"></div>
                <div id="sleep-row" class="row"></div>
                <div id="station-list" class="row"></div>
              </div>
              ${this.getStyles()}
            </ha-card>
        `;
        this.shadowRoot.querySelector('#speaker-switches')
            .appendChild(this.buildSpeakerSwitches(this._hass));
        this.shadowRoot.querySelector('#volume-row')
            .appendChild(this.buildVolumeSlider());
        this.shadowRoot.querySelector('#sleep-row')
            .appendChild(this.buildSleepTimerRow());
        this.shadowRoot.querySelector('#station-list')
            .appendChild(this.buildStationList());
    }

    getStyles() {
        return `<style>
            ha-card {
                background-color: #333;
                color: #fff;
                padding: 16px;
                font-family: sans-serif;
            }
            #content {
                display: flex;
                flex-direction: column;
                margin: 0;
                padding: 0;
            }
            .row {
                display: flex;
                flex-direction: row;
                align-items: center;
                margin: 8px 0;
                min-height: 40px; /* Ensure row has visible height */
            }
            ha-paper-slider, paper-icon-button, mwc-button, paper-tab {
                --paper-slider-knob-color: #fff;
                --paper-slider-active-color: #fff;
                --paper-slider-pin-color: #fff;
                color: #fff;
            }
            paper-icon-button {
                color: #fff !important;
                --paper-icon-button-ink-color: #fff;
                --paper-icon-button-icon-color: #fff;
            }
            paper-tab {
                padding: 8px;
                cursor: pointer;
            }
        </style>`;
    }

    buildSpeakerSwitches(hass) {
        const container = document.createElement('div');
        container.className = 'row';
        this._tabs = document.createElement('paper-tabs');
        this._tabs.setAttribute('scrollable', true);
        this._tabs.addEventListener('iron-activate', (e) => this.onSpeakerSelect(e.detail.item.entityId));
        this.config.entities.forEach(entityId => {
            if (!hass.states[entityId]) {
                console.log('Jukebox: No State for entity', entityId);
                return;
            }
            this._tabs.appendChild(this.buildSpeakerSwitch(entityId, hass));
        });
        const firstPlayingSpeakerIndex = this.findFirstPlayingIndex(hass);
        this._selectedSpeaker = this.config.entities[firstPlayingSpeakerIndex];
        this._tabs.setAttribute('selected', firstPlayingSpeakerIndex);
        container.appendChild(this._tabs);
        return container;
    }

    buildStationList() {
        this._stationButtons = [];
        const stationList = document.createElement('div');
        stationList.classList.add('row');
        this.config.links.forEach(linkCfg => {
            const stationButton = this.buildStationSwitch(linkCfg.name, linkCfg.url);
            this._stationButtons.push(stationButton);
            stationList.appendChild(stationButton);
        });
        this._hassObservers.push(this.updateStationSwitchStates.bind(this));
        return stationList;
    }

    buildVolumeSlider() {
        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'volume center horizontal layout';
        const muteButton = document.createElement('paper-icon-button');
        muteButton.setAttribute('icon', 'hass:volume-high');
        muteButton.isMute = false;
        muteButton.addEventListener('click', this.onMuteUnmute.bind(this));
        const slider = document.createElement('ha-paper-slider');
        slider.min = 0;
        slider.max = 100;
        slider.addEventListener('change', this.onChangeVolumeSlider.bind(this));
        slider.className = 'flex';
        const stopButton = document.createElement('paper-icon-button');
        stopButton.setAttribute('icon', 'hass:stop');
        stopButton.setAttribute('disabled', true);
        stopButton.addEventListener('click', this.onStop.bind(this));
        volumeContainer.appendChild(muteButton);
        volumeContainer.appendChild(slider);
        volumeContainer.appendChild(stopButton);
        this._hassObservers.push(hass => {
            if (!this._selectedSpeaker) {
                console.error('(DEBUG) no _selectedSpeaker defined');
                return;
            }
            const state = hass.states[this._selectedSpeaker];
            slider.style.display = 'block';
            muteButton.style.display = 'block';
            stopButton.style.display = 'block';
            if (!state) {
                slider.value = 50;
                stopButton.setAttribute('disabled', true);
                muteButton.setAttribute('icon', 'hass:volume-high');
                return;
            }
            const speakerState = state.attributes;
            const volLevel = speakerState.hasOwnProperty('volume_level') ? speakerState.volume_level : 0;
            slider.value = volLevel * 100;
            if (state.state === 'playing') {
                stopButton.removeAttribute('disabled');
            } else {
                stopButton.setAttribute('disabled', true);
            }
            const isMuted = speakerState.hasOwnProperty('is_volume_muted') ? speakerState.is_volume_muted : false;
            if (isMuted) {
                slider.disabled = true;
                muteButton.setAttribute('icon', 'hass:volume-off');
                muteButton.isMute = true;
            } else {
                slider.disabled = false;
                muteButton.setAttribute('icon', 'hass:volume-high');
                muteButton.isMute = false;
            }
        });
        return volumeContainer;
    }

    buildSleepTimerRow() {
        const sleepContainer = document.createElement('div');
        sleepContainer.className = 'sleep-timer center horizontal layout';
        const sleepSlider = document.createElement('ha-paper-slider');
        sleepSlider.min = 0;
        sleepSlider.max = 120;
        sleepSlider.value = 5;
        sleepSlider.addEventListener('change', (e) => {
            this._sleepMinutes = parseInt(e.detail?.value || e.target.value, 10) || 5;
        });
        sleepSlider.className = 'flex';
        const sleepSetButton = document.createElement('paper-icon-button');
        sleepSetButton.setAttribute('icon', 'hass:timer');
        sleepSetButton.addEventListener('click', () => {
            const minutes = this._sleepMinutes || 5;
            console.log(`Setting sleep timer for ${minutes} minutes on entity: ${this._selectedSpeaker}`);
            setTimeout(() => {
                console.log(`(DEBUG) sleep timer fired for entity: ${this._selectedSpeaker}`);
                this.hass.callService('media_player', 'media_stop', {
                    entity_id: this._selectedSpeaker
                }).catch(err => console.error('(DEBUG) media_stop service call failed:', err));
            }, minutes * 60000);
        });
        sleepContainer.appendChild(sleepSlider);
        sleepContainer.appendChild(sleepSetButton);
        return sleepContainer;
    }

    onSpeakerSelect(entityId) {
        this._selectedSpeaker = entityId;
        this._hassObservers.forEach(listener => listener(this.hass));
    }

    onChangeVolumeSlider(e) {
        const volPercentage = parseFloat(e.currentTarget.value);
        const vol = (volPercentage > 0 ? volPercentage / 100 : 0);
        this.setVolume(vol);
    }

    onMuteUnmute(e) {
        this.hass.callService('media_player', 'volume_mute', {
            entity_id: this._selectedSpeaker,
            is_volume_muted: !e.currentTarget.isMute
        });
    }

    onStop(e) {
        this.hass.callService('media_player', 'media_stop', {
            entity_id: this._selectedSpeaker
        });
    }

    updateStationSwitchStates(hass) {
        let playingUrl = null;
        const selectedSpeaker = this._selectedSpeaker;
        if (hass.states[selectedSpeaker] && hass.states[selectedSpeaker].state === 'playing') {
            playingUrl = hass.states[selectedSpeaker].attributes.media_content_id;
        }
        this._stationButtons.forEach(stationSwitch => {
            if (stationSwitch.hasAttribute('raised') && stationSwitch.stationUrl !== playingUrl) {
                stationSwitch.removeAttribute('raised');
                return;
            }
            if (!stationSwitch.hasAttribute('raised') && stationSwitch.stationUrl === playingUrl) {
                stationSwitch.setAttribute('raised', true);
            }
        });
    }

    buildStationSwitch(name, url) {
        const btn = document.createElement('mwc-button');
        btn.stationUrl = url;
        btn.className = 'juke-toggle';
        btn.innerText = name;
        btn.addEventListener('click', this.onMediaSelect.bind(this));
        return btn;
    }

    onMediaSelect(e) {
        this.hass.callService('media_player', 'play_media', {
            entity_id: this._selectedSpeaker,
            media_content_id: e.currentTarget.stationUrl,
            media_content_type: 'audio/mp4'
        });
    }

    setVolume(value) {
        this.hass.callService('media_player', 'volume_set', {
            entity_id: this._selectedSpeaker,
            volume_level: value
        });
    }

    findFirstPlayingIndex(hass) {
        return Math.max(0, this.config.entities.findIndex(entityId => {
            return hass.states[entityId] && hass.states[entityId].state === 'playing';
        }));
    }

    buildSpeakerSwitch(entityId, hass) {
        const btn = document.createElement('paper-tab');
        btn.entityId = entityId;
        btn.innerText = hass.states[entityId].attributes.friendly_name;
        return btn;
    }

    setConfig(config) {
        if (!config.entities) {
            throw new Error('You need to define your media player entities');
        }
        this.config = config;
    }

    getCardSize() {
        return 3;
    }
}

customElements.define('jukebox-card-ext', JukeboxCard);
