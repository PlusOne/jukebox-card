class JukeboxBoxExtended extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    set hass(hass) {
        if (!this.content) {
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
              <style>
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
                    min-height: 40px;
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
              </style>
              <div id="content">
                <div id="speaker-switches" class="row"></div>
                <div id="volume-row" class="row"></div>
                <div id="station-list" class="row"></div>
              </div>
            </ha-card>
        `;
        this.shadowRoot.querySelector('#speaker-switches')
            .appendChild(this.buildSpeakerSwitches(this._hass));
        this.shadowRoot.querySelector('#volume-row')
            .appendChild(this.buildVolumeSlider());
        this.shadowRoot.querySelector('#station-list')
            .appendChild(this.buildStationList());
    }

    buildSpeakerSwitches(hass) {
        const tabs = document.createElement('paper-tabs');
        tabs.setAttribute('scrollable', true);
        tabs.addEventListener('iron-activate', (e) => this.onSpeakerSelect(e.detail.item.entityId));

        this.config.entities.forEach(entityId => {
            if (!hass.states[entityId]) {
                console.log('Jukebox: No State for entity', entityId);
                return;
            }
            tabs.appendChild(this.buildSpeakerSwitch(entityId, hass));
        });

        const firstPlayingSpeakerIndex = this.findFirstPlayingIndex(hass);
        this._selectedSpeaker = this.config.entities[firstPlayingSpeakerIndex];
        tabs.setAttribute('selected', firstPlayingSpeakerIndex);

        return tabs;
    }

    buildStationList() {
        const stationList = document.createElement('div');
        stationList.classList.add('station-list');

        this.config.links.forEach(linkCfg => {
            const stationButton = this.buildStationSwitch(linkCfg.name, linkCfg.url);
            stationList.appendChild(stationButton);
        });

        this._hassObservers.push(this.updateStationSwitchStates.bind(this));

        return stationList;
    }

    buildVolumeSlider() {
        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'volume center horizontal layout';

        const muteButton = document.createElement('paper-icon-button');
        muteButton.icon = 'hass:volume-high';
        muteButton.isMute = false;
        muteButton.addEventListener('click', this.onMuteUnmute.bind(this));

        const slider = document.createElement('ha-paper-slider');
        slider.min = 0;
        slider.max = 100;
        slider.addEventListener('change', this.onChangeVolumeSlider.bind(this));
        slider.className = 'flex';

        const stopButton = document.createElement('paper-icon-button');
        stopButton.icon = 'hass:stop';
        stopButton.setAttribute('disabled', true);
        stopButton.addEventListener('click', this.onStop.bind(this));

        this._hassObservers.push(hass => {
            if (!this._selectedSpeaker || !hass.states[this._selectedSpeaker]) {
                return;
            }
            const speakerState = hass.states[this._selectedSpeaker].attributes;

            if (!speakerState.hasOwnProperty('volume_level')) {
                slider.setAttribute('hidden', true);
                stopButton.setAttribute('hidden', true);
            } else {
                slider.removeAttribute('hidden');
                stopButton.removeAttribute('hidden');
            }

            if (!speakerState.hasOwnProperty('is_volume_muted')) {
                muteButton.setAttribute('hidden', true);
            } else {
                muteButton.removeAttribute('hidden');
            }

            if (hass.states[this._selectedSpeaker].state === 'playing') {
                stopButton.removeAttribute('disabled');
            } else {
                stopButton.setAttribute('disabled', true);
            }

            slider.value = speakerState.volume_level ? speakerState.volume_level * 100 : 0;

            if (speakerState.is_volume_muted && !slider.disabled) {
                slider.disabled = true;
                muteButton.icon = 'hass:volume-off';
                muteButton.isMute = true;
            } else if (!speakerState.is_volume_muted && slider.disabled) {
                slider.disabled = false;
                muteButton.icon = 'hass:volume-high';
                muteButton.isMute = false;
            }
        });

        volumeContainer.appendChild(muteButton);
        volumeContainer.appendChild(slider);
        volumeContainer.appendChild(stopButton);
        return volumeContainer;
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
        btn.addEventListener('click', this.onStationSelect.bind(this));
        return btn;
    }

    onStationSelect(e) {
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
        const entity = hass.states[entityId];

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

customElements.define('jukebox-box-extended', JukeboxBoxExtended);
