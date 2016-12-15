import React, {PureComponent} from 'react';
import Slider from 'material-ui/Slider';
import {RadioButton, RadioButtonGroup} from 'material-ui/RadioButton';
import SelectField from 'material-ui/SelectField';
import MenuItem from 'material-ui/MenuItem';
import LabModel from './lab-model';
import Meter from './meter';
import models, {MIN_TEMP, MAX_TEMP} from '../models';

import '../../css/thermoscope.less';

const MODEL_WIDTH = 400;
const MODEL_HEIGHT = 400;

export default class Thermoscope extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      temperature: 20,
      liveData: false,
      materialType: 'solid',
      materialIdx: 0
    };
    this.handleTempSliderChange = this.handleTempSliderChange.bind(this);
    this.handleMaterialTypeChange = this.handleMaterialTypeChange.bind(this);
    this.handleMaterialIdxChange = this.handleMaterialIdxChange.bind(this);
    this.props.sensor.on('statusReceived', this.liveDataHandler.bind(this));
  }

  handleTempSliderChange(event, value) {
    this.setState({temperature: value});
  }

  handleMaterialTypeChange(event, value) {
    this.setState({materialType: value, materialIdx: 0});
  }

  handleMaterialIdxChange(event, value) {
    this.setState({materialIdx: value});
  }

  liveDataHandler() {
    if (this.props.sensor && this.props.sensor.liveSensors) {
      let newData = this.props.sensor.liveSensors[this.props.probeIndex].liveValue;
      if (!isNaN(newData) && isFinite(newData)) this.setState({ temperature: newData, liveData: true });
    }
  }

  onMeterChange(value) {
    let range = MAX_TEMP - MIN_TEMP;
    let scaledValue = Math.round(value * range);
    scaledValue = MIN_TEMP != 0 ? scaledValue + MIN_TEMP : scaledValue;
    this.setState({temperature: scaledValue});
  }

  render() {
    const { temperature, materialType, materialIdx, liveData } = this.state;
    const model = models[materialType][materialIdx];

    let meterSegments = [
      {
        color: "#800000",
        start: 0,
        end: 45
      },
      {
        color: "#a0a000",
        start: 45,
        end: 145
      },
      {
        color: "#008000",
        start: 145,
        end: 180
      }
    ];

    return (
      <div className="thermoscope">
        <Meter minValue={MIN_TEMP} maxValue={MAX_TEMP} currentValue={temperature} background="#444" segments={meterSegments} onMeterChange={(val) => this.onMeterChange(val)}/>
        <LabModel temperature={temperature}
                  model={model.json}
                  tempScale={model.tempScale}
                  timeStepScale={model.timeStepScale}
                  width={MODEL_WIDTH} height={MODEL_HEIGHT}/>
        <div>
          <div className="controls-row">
            Temperature {temperature}°C
            <div className="slider">
              {!liveData && <Slider min={MIN_TEMP} max={MAX_TEMP} step={1} value={temperature}
                sliderStyle={{ marginTop: 5, marginBottom: 5 }}
                name="temperature"
                onChange={this.handleTempSliderChange} />}
            </div>
          </div>
          <div className="controls-row">
            <div className="material-type-select">
              <RadioButtonGroup name="material-type" valueSelected={materialType} onChange={this.handleMaterialTypeChange}>
                <RadioButton value="solid" label="Solid"/>
                <RadioButton value="liquid" label="Liquid"/>
                <RadioButton value="gas" label="Gas"/>
              </RadioButtonGroup>
            </div>
            <div className="material-select">
              <SelectField floatingLabelText="Material" value={materialIdx} onChange={this.handleMaterialIdxChange}>
                {models[materialType].map((model, idx) =>
                  <MenuItem key={idx} value={idx} primaryText={model.name}/>
                )}
              </SelectField>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
