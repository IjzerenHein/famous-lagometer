/**
 * This Source Code is licensed under the MIT license. If a copy of the
 * MIT-license was not distributed with this file, You can obtain one at:
 * http://opensource.org/licenses/mit-license.html.
 *
 * @author: Hein Rutjes (IjzerenHein)
 * @license MIT
 * @copyright Gloey Apps, 2014
 */

/*jslint browser:true, nomen:true, vars:true, plusplus:true*/
/*global define*/

define(function(require, exports, module) {
    'use strict';

    // import dependencies
    var Engine = require('famous/core/Engine');
    var CanvasSurface = require('famous/surfaces/CanvasSurface');
    var View = require('famous/core/View');

    /**
     * @class Lagometer
     * @extends View
     * @constructor
     * @param {Object} [options] Configuration options
     */
    function Lagometer(options) {
        View.apply(this, arguments);

        // Create sample-buffer
        this.samples = [];
        this.sampleIndex = 0;
        this.Samples = this.options.size[0];

        // Install render-handlers
        Engine.on('prerender', this._onEngineRender.bind(this, true));
        Engine.on('postrender', this._onEngineRender.bind(this, false));

        // Create drawing canvas
        this.canvas = new CanvasSurface(this.options.canvasSurface);
        this.add(this.canvas);
    }
    Lagometer.prototype = Object.create(View.prototype);
    Lagometer.prototype.constructor = Lagometer;

    Lagometer.DEFAULT_OPTIONS = {
        size: [100, 100],
        min: 0,
        max: 34,
        backgroundColor: 'rgba(200, 0, 0, 0.8)',
        borderColor: 'rgba(255, 0, 0, 0.8)',
        textColor: 'rgba(255, 255, 255, 0.8)',
        font: '28px Arial',
        frameColor: '#00FF00',
        scriptColor: '#BBBBFF',
        canvasSurface: {
            properties: {
                'pointer-events': 'none'
            }
        },
        drawFrequence: 2 // 2 = twice per second, 1000 = as fast as possible
    };

    /**
     * @method _onEngineRender
     */
    Lagometer.prototype._onEngineRender = function(pre) {
        var currentTime = window.performance ? window.performance.now() : Date.now();
        if (pre) {

            // Count number of frames
            if (!this.firstFrameTime) {
                this.frameCount = 0;
                this.firstFrameTime = currentTime;
            }
            else {
                this.frameCount++;
            }

            // Determine the time that was spent between two 'animation-frames'
            if (this.lastTime !== undefined) {
                this.frameTime = currentTime - this.lastTime;
                if (this.maxFrameTime === undefined) {
                    this.maxFrameTime = this.frameTime;
                }
                this.maxFrameTime = Math.max(this.frameTime, this.maxFrameTime);
                if (this.minFrameTime === undefined) {
                    this.minFrameTime = this.frameTime;
                }
                this.minFrameTime = Math.min(this.frameTime, this.minFrameTime);
            }
            this.lastTime = currentTime;

        } else if (this.frameTime !== undefined) {

            // Determine the time that was spent in the script
            this.scriptTime = currentTime - this.lastTime;
            if (this.maxScriptTime === undefined) {
                this.maxScriptTime = this.scriptTime;
            }
            this.maxScriptTime = Math.max(this.scriptTime, this.maxScriptTime);
            if (this.minScriptTime === undefined) {
                this.minScriptTime = this.scriptTime;
            }
            this.minScriptTime = Math.min(this.scriptTime, this.minScriptTime);

            // Create sample
            var sample = {
                lastTime: this.lastTime,
                frameTime: this.frameTime,
                scriptTime: this.scriptTime
            };
            var maxSamples = this.options.size[0] * 2;
            if (this.samples.length < maxSamples) {
                this.sampleIndex = this.samples.length;
                this.samples.push(sample);
            }
            else {
                this.sampleIndex = (this.sampleIndex + 1) % maxSamples;
                this.samples[this.sampleIndex] = sample;
            }
        }
    };

    /**
     * @method _drawSamples
     */
    Lagometer.prototype._drawSamples = function(draw) {
        draw.context.beginPath();
        var i;
        var bufferIndex = draw.index;
        var size = draw.size;
        var yScale = size[1] / (draw.max - draw.min);
        for (i = 0; i < draw.buffer.length; i++) {
            var x = size[0] - i;
            var sample = draw.buffer[bufferIndex][draw.property];
            var y = size[1] - ((sample - draw.min) * yScale);
            if (i === 0) {
                draw.context.moveTo(x, y);
            }
            else {
                draw.context.lineTo(x, y);
            }
            bufferIndex--;
            if (bufferIndex < 0) {
                bufferIndex = draw.buffer.length - 1;
            }
        }
        draw.context.lineWidth = 1;
        draw.context.strokeStyle = draw.color;
        draw.context.stroke();
    };

    /**
     * Calculates the FPS, averaged over the last x samples of data
     */
    Lagometer.prototype.getFPS = function(count) {
        count = Math.min(count, this.samples.length);
        var bufferIndex = this.sampleIndex;
        var fps = 0;
        for (var i = 0, j = count; i < j; i++) {
            var sample = this.samples[bufferIndex];
            fps += sample.frameTime;
            bufferIndex--;
            if (bufferIndex < 0) {
                bufferIndex = this.samples.length - 1;
            }
        }
        return 1000 / (fps / count);
    };

    /**
     * Calculates the script time, averages over the x last samples of data
     */
    Lagometer.prototype.getScriptTime = function(count) {
        count = Math.min(count, this.samples.length);
        var bufferIndex = this.sampleIndex;
        var total = 0;
        for (var i = 0, j = count; i < j; i++) {
            var sample = this.samples[bufferIndex];
            total += sample.scriptTime;
            bufferIndex--;
            if (bufferIndex < 0) {
                bufferIndex = this.samples.length - 1;
            }
        }
        return total / count;
    };

    /**
     * Get the total number of dropped frames.
     */
    Lagometer.prototype.getDroppedFrameCount = function() {
        if (this.frameCount <= 1) {
            return 0;
        }
        var expectedFrameCount = (this.lastTime - this.firstFrameTime) / (1000.0 / 60.0);
        return Math.floor(expectedFrameCount - this.frameCount);
    };

    /**
     * Renders the view.
     */
    Lagometer.prototype.render = function render() {

        // Check whether to render or not this cycle
        var timestamp = Date.now();
        if (this._renderTimestamp &&
            ((timestamp - this._renderTimestamp) < (1000 / this.options.drawFrequence))) {
            return this._node.render();
        }
        this._renderTimestamp = timestamp;

        // prepare
        var context = this.canvas.getContext('2d');
        var size = this.getSize();
        var canvasSize = [size[0] * 2, size[1] * 2];

        // Update canvas size
        if (!this._cachedSize ||
            (this._cachedSize[0] !== size[0]) ||
            (this._cachedSize[1] !== size[1]) ||
            (this._cachedCanvasSize[0] !== canvasSize[0]) ||
            (this._cachedCanvasSize[1] !== canvasSize[1])) {
            this._cachedSize = size;
            this._cachedCanvasSize = canvasSize;
            this.canvas.setSize(size, canvasSize);
        }

        // Clear background
        context.clearRect(0, 0, canvasSize[0], canvasSize[1]);
        context.fillStyle = this.options.backgroundColor;
        context.fillRect(0, 0, canvasSize[0], canvasSize[1]);
        context.lineWidth = 1;
        context.strokeStyle = this.options.borderColor;
        context.strokeRect(0, 0, canvasSize[0], canvasSize[1]);

        // Calculate min/max
        var min = this.options.min;
        var max = this.options.max;

        // Prepare text drawing
        context.fillStyle = this.options.textColor;
        context.font = this.options.font;
        context.textAlign = 'end';

        // Draw fps (calculated over last 20 frames)
        var fps = Math.round(this.getFPS(20));
        context.fillText(fps + ' fps', canvasSize[0] - 10, 30);

        // Draw script-time (calculated over last 20 frames)
        var scriptTime = Math.round(this.getScriptTime(20));
        context.fillText(scriptTime + ' ms', canvasSize[0] - 10, canvasSize[1] - 20);

        // Draw missed-frames count
        var missedFrames = this.getDroppedFrameCount();
        context.fillText(missedFrames + ' df', canvasSize[0] - 10, 60);

        // Draw frame-times
        this._drawSamples({
            context: context,
            size: canvasSize,
            buffer: this.samples,
            index: this.sampleIndex,
            min: min,
            max: max,
            property: 'frameTime',
            color: this.options.frameColor
        });

        // Draw script-times
        this._drawSamples({
            context: context,
            size: canvasSize,
            buffer: this.samples,
            index: this.sampleIndex,
            min: min,
            max: max,
            property: 'scriptTime',
            color: this.options.scriptColor
        });

        // Call super
        return this._node.render();
    };

    module.exports = Lagometer;
});
