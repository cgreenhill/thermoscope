import React, {PureComponent} from 'react';
import ReactDOM from 'react-dom';
import Lab from 'react-lab';
import NewAtomBin from './new-atom-bin';
import Authoring from './authoring';
import models from './models/';
// Set of authorable properties which can be overwritten by the url hash.
import authorableProps from './models/authorable-props';
import { getStateFromHashWithDefaults, getDiffedHashParams, parseToPrimitive, getURLParam, getModelDiff, loadModelDiff } from '../utils';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import RaisedButton from 'material-ui/RaisedButton';
import DeleteIcon from 'material-ui/svg-icons/action/delete-forever';
import LogoMenu from '../components/logo-menu';
import injectTapEventPlugin from 'react-tap-event-plugin';

import '../../css/app.less';
import '../../css/particle-modeler.less';

// Required by Material-UI library.
injectTapEventPlugin();

let api, lab;

let atomBox = {
      x: 0.37,
      y: 2.22,
      spacing: 0.24
    },
    delIcon = {
      x: 4.187,
      y: 0.141,
      width: 0.141,
      height: 0.146
  };

let particleMaxVelocity = 0.0005;
let saveInterval = 2000;

export default class Interactive extends PureComponent {

  constructor(props) {
    super(props);

    let hashParams = window.location.hash.substring(1),
      model = models.emptyModel,
      authoredState = getStateFromHashWithDefaults(hashParams, authorableProps),
      urlModel = getURLParam("model");
    if (urlModel) {
      authoredState = loadModelDiff(JSON.parse(atob(urlModel)), authorableProps);
      if (authoredState.atoms) model.atoms = authoredState.atoms;
    }

    this.state = {
      interactive: models.interactive,
      model,
      showAtom0: true,
      showAtom1: true,
      showAtom2: true,
      deleteHover: false,
      showRestart: false,
      speedSlow: false,
      pinnedAtoms: {},
      nextUpdate: Date.now(),
      ...authoredState
    };

    this.handleModelLoad = this.handleModelLoad.bind(this);
    this.addNewDraggableAtom = this.addNewDraggableAtom.bind(this);
    this.handleAuthoringPropChange = this.handleAuthoringPropChange.bind(this);
    this.changeElementCount = this.changeElementCount.bind(this);
    this.freeze = this.freeze.bind(this);
    this.speed = this.speed.bind(this);
    this.restart = this.restart.bind(this);
    this.studentView = this.studentView.bind(this);
    this.generatePinnedParticleText = this.generatePinnedParticleText.bind(this);
    this.addPinnedParticleText = this.addPinnedParticleText.bind(this);
    this.removePinnedParticleText = this.removePinnedParticleText.bind(this);
    this.getCurrentModelLink = this.getCurrentModelLink.bind(this);
  }

  componentWillMount() {
    this.captureErrors();
  }

  captureErrors() {
    window.onerror = (message, file, line, column, errorObject) => {
      column = column || (window.event && window.event.errorCharacter);
      var stack = errorObject ? errorObject.stack : null;

      var data = {
        message: message,
        file: file,
        line: line,
        column: column,
        errorStack: stack,
      };
      // If we want to log externally, use data, or grab on the console for more information
      // console.log(data);
      if (file.indexOf("lab.min.js") > -1) {
        // likely indication of divergent lab model - offer a graceful restart button
        this.setState({ showRestart: true });
      }
    }
  }

  setModelProps(prevState = {}) {
    let newModelProperties = {},
        newElementProperties = [{}, {}, {}],
        newPairwiseProperties = [[{}, {}, {}], [{}, {}, {}], [{}, {}, {}]];
    for (let prop in authorableProps) {
      let value = this.state[prop];
      if (value !== "" && value !== prevState[prop]) {
        if (value.hasOwnProperty("element")) {
          newElementProperties[value.element][value.property] = parseToPrimitive(value);
        } else if (value.hasOwnProperty("element1")) {
          newPairwiseProperties[parseToPrimitive(value.element1)][parseToPrimitive(value.element2)][value.property] = parseToPrimitive(value);
        } else {
          newModelProperties[prop] = parseToPrimitive(value);
        }
      }
    }

    api.set(newModelProperties);

    for (let elem in newElementProperties) {
      api.setElementProperties(elem, newElementProperties[elem]);
    }
    for (let elem1 = 0; elem1 < newPairwiseProperties.length; elem1++) {
      for (let elem2 = 0; elem2 < newPairwiseProperties[elem1].length; elem2++) {
        let pairValue = newPairwiseProperties[elem1][elem2];
        if (Object.keys(pairValue).length > 0) {
          if (this.state[`pair${(elem1+1)}${(elem2+1)}Forces`].value) {
            api.setPairwiseLJProperties(elem1, elem2, { sigma: parseToPrimitive(this.state[`pair${(elem1+1)}${(elem2+1)}Sigma`].value), epsilon: parseToPrimitive(this.state[`pair${(elem1+1)}${(elem2+1)}Epsilon`].value) });
          } else {
            api.removePairwiseLJProperties(elem1, elem2);
          }
        }
      }
    }
  }

  componentDidUpdate(prevProps, prevState) {
    let hash = getDiffedHashParams(this.state, authorableProps);
    window.location.hash = hash;
    this.setModelProps(prevState);
  }

  getAtomsWithoutPlaceholders() {
    //clean out placeholder atoms - they get added separately
    let ax = [], ay = [], vx = [], vy = [], charge = [], friction = [], element = [], pinned = [], draggable = [];
    for (var i = 0, a; i < api.getNumberOfAtoms(); i++) {
      a = api.getAtomProperties(i);
      // only add live elements, not draggable, pinned placeholders
      if (a.element < this.state.elements.value) {
        ax.push(a.x);
        ay.push(a.y);
        vx.push(a.vx);
        vy.push(a.vy);
        charge.push(a.charge);
        friction.push(a.friction);
        element.push(a.element);
        pinned.push(a.pinned);
        draggable.push(a.draggable);
      }
    }
    let atoms = {
      x: ax, y: ay, vx, vy, charge, friction, element, pinned, draggable
    };
    return atoms;
  }

  saveModel(d) {
    // To save entire model:
    // let newModel = lab.interactiveController.getModel().serialize();
    // Alternatively, store the current model snapshot diff timestamped for replay
    // console.log("save model", d, Date.now());
  }


  handleModelLoad() {
    api = lab.scriptingAPI;
    this.addPinnedParticleText();
    api.onDrag('atom', (x, y, d, i) => {
      if (d.pinned === 1) {
        let el = d.element,
          newState = {};
        // initial spawned elements do not interact with the simulation
        if (el >= this.state.elements.value) {
          el -= 3;
          newState["showAtom"+el] = false;
        } else {
          // this was a pinned live particle
          this.removePinnedParticleText(i)
        }
        api.setAtomProperties(i, {pinned: 0, element: el});

        this.setState(newState);
        this.addNewDraggableAtom(el);
      } else {
        if (d.x > delIcon.x && d.x < delIcon.x+delIcon.width && d.y > delIcon.y && d.y < delIcon.y+delIcon.height) {
          // mark atoms for deletion
          if (!d.marked) {
            this.setState({deleteHover: true});
            api.setAtomProperties(i, { marked: 1 });

          }
        } else if (d.marked) {
          this.setState({deleteHover: false});
          api.setAtomProperties(i, {marked: 0});
        }
      }
      if (this.state.nextUpdate < Date.now()) {
        // this triggers component update & save
        this.setState({ nextUpdate: Date.now() + saveInterval, atoms: this.getAtomsWithoutPlaceholders()});
      }
    });

    api.onClick('atom', (x, y, d, i) => {
      //console.log(d);
      if (d.pinned === 0) {
        api.setAtomProperties(i, { pinned: 1 });
        let newState = this.state.pinnedAtoms;
        newState[i] = { x, y };
        this.setState({ pinnedAtoms: newState });
        this.addPinnedParticleText(i);
      } else {
        api.setAtomProperties(i, { pinned: 0 });
        this.removePinnedParticleText(i);
      }
      this.setState({ nextUpdate: Date.now(), atoms: this.getAtomsWithoutPlaceholders()});
    });

    api.onPropertyChange('time', function (t) {
      // this will fire every tick
      for (var i = 0, a; i < api.getNumberOfAtoms(); i++) {
        a = api.getAtomProperties(i);
        if (((a.vx * a.vx) + (a.vy * a.vy)) > particleMaxVelocity) {
          // particles moving too fast can cause the model to freeze up
          let adjustedVx = a.vx * 0.01;
          let adjustedVy = a.vy * 0.01;
          api.setAtomProperties(i, { vx: adjustedVx, vy: adjustedVy });
        }
      }
    });
    let deleteMarkedAtoms = () => {
      let atomsToDelete = [];
      for (let i=0, ii=api.getNumberOfAtoms(); i<ii; i++) {
        if (api.getAtomProperties(i).marked && ! api.getAtomProperties(i).pinned)
          atomsToDelete.push(i);
      }
      for (let i=atomsToDelete.length-1; i>-1; i--) {
        api.removeAtom(atomsToDelete[i]);
      }

      this.setState({deleteHover: false});
    }

    lab.iframe.contentDocument.body.onmouseup = deleteMarkedAtoms;
    lab.iframe.contentDocument.body.style.touchAction = "none";

    for (let i = 0; i < this.state.elements.value; i++){
      this.addNewDraggableAtom(i);
    }

    this.setModelProps();
  }

  generatePinnedParticleText(i) {
      let textProps = {
          "text": "P",
          "hostType": "Atom",
          "hostIndex": i,
          "layer": 1,
          "textAlign": "center",
          "width": 0.3
        };
      return textProps;
  }

  addPinnedParticleText(particle) {
    if (!particle) {
      // add boxes for all pinned particles
      api.set({ 'textboxes': {} });
      let textToAdd = [];
      for (let i = 0; i < api.getNumberOfAtoms(); i++){
        let a = api.getAtomProperties(i);
        if (a.pinned && a.element < this.state.elements.value) {
          let textProps = this.generatePinnedParticleText(i);
          api.addTextBox(textProps);
        }
      }
    } else {
      // add box for specific particle
      let textProps = this.generatePinnedParticleText(particle);
      api.addTextBox(textProps);
    }
  }
  removePinnedParticleText(particle) {
    let textboxes = api.get('textBoxes');
    let textToRemove = -1;
    for (let i = 0; i < textboxes.length; i++){
      if (textboxes[i].hostIndex == particle) {
        textToRemove = i;
        break;
      }
    }
    if (textToRemove > -1) api.removeTextBox(textToRemove);
  }

  addNewDraggableAtom(el = 0, skipCheck = false) {
    if (skipCheck || this.state.elements.value > el) {
      let y = atomBox.y - (el * atomBox.spacing),
        added = api.addAtom({ x: atomBox.x, y: y, element: (el + 3), draggable: 1, pinned: 1 });
      if (!added) {
        setTimeout(() => this.addNewDraggableAtom(el), 2000);
      } else {
        let newState = {};
        newState["showAtom" + el] = true;
        this.setState(newState);
      }
    }
  }

  restart() {
    console.log("restart");
    window.location.reload();
  }

  studentView() {
    this.setState({ authoring: false });
  }

  freeze() {
    let oldTemp = this.state.targetTemperature.value,
        oldControl = this.state.temperatureControl.value;
    api.set({temperatureControl: true});
    api.set({targetTemperature: 0});
    setTimeout(function() {
      api.set({temperatureControl: oldControl});
      api.set({targetTemperature: oldTemp});
    }, 500)
  }

  speed() {
    let speed = !this.state.speedSlow;
    let timeStep = this.state.timeStep;
    if (speed) {
      timeStep.value /= 10;
    } else {
      timeStep.value *= 10;
    }
    api.set({timeStep: timeStep.value});
    this.setState({ speedSlow: speed , timeStep: timeStep });
  }

  handleAuthoringPropChange(prop, value) {
    let newState = {};
    newState[prop] = {...this.state[prop]};
    newState[prop].value = parseToPrimitive(value);

    if (prop === "elements") {
      this.changeElementCount(value);
    }
    newState.nextUpdate = Date.now();
    newState.atoms = this.getAtomsWithoutPlaceholders();
    this.setState(newState);
  }

  changeElementCount(newElementCount) {
    // has the number of elements been increased
    if (newElementCount > this.state.elements.value) {
      for (let i = this.state.elements.value; i < newElementCount; i++){
        this.addNewDraggableAtom(i, true);
      }
    } else {
      let atomsToDelete = [];
      // iterate through all atoms, remove any for elements no longer needed
      for (let i = 0, ii = api.getNumberOfAtoms(); i < ii; i++) {
        if (api.getAtomProperties(i).element >= newElementCount)
          atomsToDelete.push(i);
      }
      for (let i = atomsToDelete.length - 1; i > -1; i--) {
        api.removeAtom(atomsToDelete[i]);
      }
      // because initial draggable elements are a different type, recreate the hidden dragables after deleting
      for (let i = 0; i < newElementCount; i++){
        this.addNewDraggableAtom(i, true);
      }
    }
  }
  getCurrentModelLink() {
    if (this.state.authoring) {
      let d = getModelDiff(this.state, authorableProps);
      if (d) {
        // this is called each render, save model each render
        this.saveModel(d);
        let link = JSON.stringify(d);
        let encodedLink = btoa(link);
        let hlink = window.location.host + window.location.pathname + "?model=" + encodedLink;
        return <div key="modelUri"><a href={hlink} target="_blank">Link for Current Model</a></div>;
      }
    }
    return null;
  }

  render() {
    const { authoring, showFreezeButton, showRestart, speedSlow} = this.state;
    let appClass = "app";
    if (authoring) {
      appClass += " authoring";
    }

    let deleteOpacity = this.state.deleteHover ? 0.3 : 0.7;
    let newAtomVisibility = {
      atomsToShow: [this.state.showAtom0, this.state.showAtom1, this.state.showAtom2],
      count: this.state.elements.value
    };
    return (
      <MuiThemeProvider>
        <div className={appClass}>
          <LogoMenu scale="logo-menu small" showNav="true" />
          <div className="app-container">
            <div className="lab-wrapper">
              <Lab ref={node => lab = node} model={this.state.model} interactive={this.state.interactive} height='380px'
                  playing={true} onModelLoad={this.handleModelLoad} embeddableSrc='../lab/embeddable.html'/>
              <div className="lab-ui">
                <NewAtomBin atomVisibility={newAtomVisibility} />
                {showFreezeButton.value === true &&
                  <div>
                    <button className="freeze-button" onClick={this.freeze}><div title="Freeze"><i className="material-icons">ac_unit</i></div></button>
                    <button className="speed-button" onClick={this.speed}><div title="Speed">
                    {speedSlow && <i className="material-icons">directions_walk</i>}
                    {!speedSlow && <i className="material-icons">directions_run</i>}
                    </div></button>
                  </div>
                }
                <DeleteIcon className="delete-icon" style={{ width: 45, height: 50, opacity: deleteOpacity }} />
              </div>
            </div>
            {showRestart && <RaisedButton id="restart" className="restart-button" onClick={this.restart}>Restart</RaisedButton>}
            {authoring && <RaisedButton id="studentView" className="student-button" onClick={this.studentView}>Switch to Student View</RaisedButton>}
            {authoring && <Authoring {...this.state} onChange={this.handleAuthoringPropChange} />}
            {this.getCurrentModelLink()}
          </div>
        </div>
      </MuiThemeProvider>
    );
  }
}

ReactDOM.render(<Interactive/>, document.getElementById('app'));
