import React from 'react';
import PropTypes from 'prop-types';
import { size, filter, forEach, extend } from 'lodash';
import { react2angular } from 'react2angular';
import { sortableContainer, sortableElement, sortableHandle } from 'react-sortable-hoc';
import { $location } from '@/services/ng';
import { Parameter } from '@/services/query';
import ParameterApplyButton from '@/components/ParameterApplyButton';
import ParameterValueInput from '@/components/ParameterValueInput';
import EditParameterSettingsDialog from './EditParameterSettingsDialog';

import './Parameters.less';

const DragHandle = sortableHandle(({ parameterName }) => (
  <div className="drag-handle" data-test={`DragHandle-${parameterName}`} />
));

const SortableItem = sortableElement(({ className, parameterName, disabled, children }) => (
  <div className={className}>
    {!disabled && <DragHandle parameterName={parameterName} />}
    {children}
  </div>
));
const SortableContainer = sortableContainer(({ children }) => children);

function updateUrl(parameters) {
  const params = extend({}, $location.search());
  parameters.forEach((param) => {
    extend(params, param.toUrlParams());
  });
  Object.keys(params).forEach(key => params[key] == null && delete params[key]);
  $location.search(params);
}

export class Parameters extends React.Component {
  static propTypes = {
    parameters: PropTypes.arrayOf(PropTypes.instanceOf(Parameter)),
    editable: PropTypes.bool,
    onValuesChange: PropTypes.func,
    onParametersEdit: PropTypes.func,
  };

  static defaultProps = {
    parameters: [],
    editable: false,
    onValuesChange: () => {},
    onParametersEdit: () => {},
  }

  constructor(props) {
    super(props);
    const { parameters } = props;
    this.state = { parameters };
    updateUrl(parameters);
  }

  componentDidUpdate = (prevProps) => {
    const { parameters } = this.props;
    if (prevProps.parameters !== parameters) {
      this.setState({ parameters });
      updateUrl(parameters);
    }
  };

  handleKeyDown = (e) => {
    const { parameters } = this.props;
    const dirtyParamCount = size(filter(parameters, 'hasPendingValue'));

    // Cmd/Ctrl/Alt + Enter
    if (dirtyParamCount > 0 && e.keyCode === 13 && (e.ctrlKey || e.metaKey || e.altKey)) {
      e.stopPropagation();
      this.applyChanges();
    }
  };

  setPendingValue = (param, value, isDirty) => {
    this.setState(({ parameters }) => {
      if (isDirty) {
        param.setPendingValue(value);
      } else {
        param.clearPendingValue();
      }
      return { parameters };
    });
  };

  moveParameter = ({ oldIndex, newIndex }) => {
    const { onParametersEdit } = this.props;
    if (oldIndex !== newIndex) {
      this.setState(({ parameters }) => {
        parameters.splice(newIndex, 0, parameters.splice(oldIndex, 1)[0]);
        onParametersEdit();
        return { parameters };
      });
    }
  };

  applyChanges = () => {
    const { onValuesChange } = this.props;
    this.setState(({ parameters }) => {
      forEach(parameters, p => p.applyPendingValue());
      onValuesChange();
      updateUrl(parameters);
      return { parameters };
    });
  };

  showParameterSettings = (parameter, index) => {
    const { onParametersEdit } = this.props;
    EditParameterSettingsDialog
      .showModal({ parameter })
      .result.then((updated) => {
        this.setState(({ parameters }) => {
          const updatedParameter = extend(parameter, updated);
          parameters[index] = new Parameter(updatedParameter, updatedParameter.parentQueryId);
          onParametersEdit();
          return { parameters };
        });
      });
  };

  renderParameter(param, index) {
    const { editable } = this.props;
    return (
      <div
        key={param.name}
        className="di-block"
        data-test={`ParameterName-${param.name}`}
      >
        <div className="parameter-heading">
          <label className="flex-fill">{param.title || param.name}</label>
          {editable && (
            <button
              className="btn btn-default btn-xs m-l-5"
              onClick={() => this.showParameterSettings(param, index)}
              data-test={`ParameterSettings-${param.name}`}
              type="button"
            >
              <i className="fa fa-cog" />
            </button>
          )}
        </div>
        <ParameterValueInput
          type={param.type}
          value={param.normalizedValue}
          parameter={param}
          enumOptions={param.enumOptions}
          queryId={param.queryId}
          onSelect={(value, isDirty) => this.setPendingValue(param, value, isDirty)}
        />
      </div>
    );
  }

  render() {
    const { parameters } = this.state;
    const { editable } = this.props;
    const dirtyParamCount = size(filter(parameters, 'hasPendingValue'));
    return (
      <SortableContainer axis="xy" onSortEnd={this.moveParameter} lockToContainerEdges useDragHandle>
        <div className="parameter-container" onKeyDown={this.handleKeyDown}>
          {parameters.map((param, index) => (
            <SortableItem className="parameter-block" key={param.name} index={index} parameterName={param.name} disabled={!editable}>
              {this.renderParameter(param, index)}
            </SortableItem>
          ))}

          <ParameterApplyButton onClick={this.applyChanges} paramCount={dirtyParamCount} />
        </div>
      </SortableContainer>
    );
  }
}

export default function init(ngModule) {
  ngModule.component('parameters', react2angular(Parameters));
}

init.init = true;
