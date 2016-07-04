'use strict';

/**
 * hojs
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import fs from 'fs';
import util from 'util';
import assert from 'assert';
import request from 'supertest';
import utils from 'lei-utils';
import {test as debug, create as createDebug} from './debug';

/* 支持的HTTP请求方法 */
const SUPPORT_METHOD = ['get', 'post', 'put', 'delete'];

/* 输出结果断言错误 */
const AssertionError = utils.customError('AssertionError', {type: 'api_output_error'});

/* 空回调函数 */
const noop = () => {};

/**
 * 返回对象结构字符串
 *
 * @param {Object} obj
 * @return {String}
 */
function inspect(obj) {
  return util.inspect(obj, {
    depth: 5,
    colors: true,
  });
}

/**
 * 测试代理类
 */
export default class TestAgent {

  /**
   * 构造函数
   *
   * @param {String} method HTTP请求方法
   * @param {String} path 请求路径
   * @param {Object} sourceFile 源文件路径描述对象
   * @param {Object} parent hojs实例
   */
  constructor(method, path, key, sourceFile, parent) {
    assert(method && typeof method === 'string', '`method` must be string');
    assert(TestAgent.SUPPORT_METHOD.indexOf(method.toLowerCase()) !== -1, '`method` must be one of ' + TestAgent.SUPPORT_METHOD);
    assert(path && typeof path === 'string', '`path` must be string');
    assert(path[0] === '/', '`path` must be start with "/"');
    this.options = {
      parent,
      sourceFile,
      method: method.toLowerCase(),
      path,
      agent: null,
    };
    this.key = `${method.toUpperCase()} ${key}`;
    this._extendsOutput();
    this.debug = createDebug(`agent:${this.key}`);
    this.debug('new: %s %s from %s', method, path, sourceFile.absolute);
  }

  /**
   * 设置`supertest.Agent`实例
   *
   * @param {Object} agent
   */
  setAgent(agent) {
    this.options.agent = agent;
  }

  /**
   * 初始化`supertest.Agent`实例
   *
   * @param {Object} app Express实例
   */
  initAgent(app) {
    assert(app, `express app instance could not be empty`);
    this.debug('create supertest agent');
    this.setAgent(request(app)[this.options.method](this.options.path));
  }

  /**
   * 获取测试代理
   *
   * @param {Boolean} rawSupertest `true`表示返回`supertest.Agent`实例，`false`返回`TestAgent`实例
   */
  agent(rawSupertest = false) {
    debug('agent: rawSupertest=%s', rawSupertest);
    if (rawSupertest) {
      return this.options.agent;
    } else {
      return this;
    }
  }

  /**
   * 输入参数
   *
   * @param {Object} data
   * @return {Object}
   */
  input(data) {
    this.debug('input: %j', data);
    if (this.options.method === 'get' || this.options.method === 'head') {
      this.options.agent.query(data);
    } else {
      for (const i in data) {
        if (data[i] instanceof fs.ReadStream) {
          this.options.agent.attach(i, data[i]);
        } else {
          this.options.agent.field(i, data[i]);
        }
      }
    }
    return this;
  }

  /**
   * 输出结果
   *
   * @param {Function} callback
   */
  output(callback) {
    const self = this;
    callback = callback || noop;
    return new Promise((resolve, reject) => {
      self.options.agent.end((err, res) => {
        if (err) {
          callback(err);
          reject(err);
          return;
        }
        const formatOutputReverse = self.options.parent.api.getOption('formatOutputReverse');
        const [err2, ret] = formatOutputReverse(res.body);
        callback(err2, ret);
        err2 ? reject(err2) : resolve(ret);
      });
    });
  }

  _extendsOutput() {

    /**
     * 期望输出成功结果
     *
     * @param {Function} callback
     */
    this.output.success = (callback) => {
      callback = callback || noop;
      return new Promise((resolve, reject) => {
        this.output((err, ret) => {
          if (err) {
            const err2 = new AssertionError(`output expected success but got an error ${inspect(err)}`);
            callback(err2);
            reject(err2);
          } else {
            callback(null, ret);
            resolve(ret);
          }
        });
      });
    };

    /**
     * 期望输出失败结果
     *
     * @param {Function} callback
     */
    this.output.error = (callback) => {
      callback = callback || noop;
      return new Promise((resolve, reject) => {
        this.output((err, ret) => {
          if (err) {
            callback(null, err);
            resolve(err);
          } else {
            const err2 = new AssertionError(`output expected an error but got result ${inspect(ret)}`);
            callback(err2);
            reject(err2);
          }
        });
      });
    };

  }

}

/* 支持的HTTP请求方法 */
TestAgent.SUPPORT_METHOD = SUPPORT_METHOD;
