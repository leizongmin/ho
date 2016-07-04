'use strict';

/**
 * hojs
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import assert from 'assert';
import supertest from 'supertest';
import {getCallerSourceLine} from '../utils';
import {test as debug} from '../debug';
import TestAgent from '../test_agent';

export default function () {

  this.test = {};

  const findSchemaByPath = (path) => {
    if (this.api.$schemaMapping[path]) return this.api.$schemaMapping[path];
    for (const key in this.api.$schemaMapping) {
      const s = this.api.$schemaMapping[key];
      if (s.pathTest.test(path)) {
        return s;
      }
    }
  };

  // test.get, this.post, ...
  for (const method of TestAgent.SUPPORT_METHOD) {
    this.test[method] = (path, rawSupertest) => {

      const s = findSchemaByPath(path);
      assert(s, `try to request undefined API ${s.key}`);
      const a = new TestAgent(method, path, s.key, getCallerSourceLine(this.config.get('api.path')), this);

      a.initAgent(this.api.$express.app);
      return a.agent(rawSupertest);

    };
  }

  this.test.session = () => {

    const session = {};
    session.$$agent = supertest.agent(this.api.$express.app);

    for (const method of TestAgent.SUPPORT_METHOD) {
      session[method] = (path, rawSupertest) => {

        const s = findSchemaByPath(path);
        assert(s, `try to request undefined API ${s.key}`);
        const a = new TestAgent(method, path, s.key, getCallerSourceLine(this.config.get('api.path')), this);

        a.setAgent(session.$$agent[method](path));
        return a.agent(rawSupertest);

      };
    }

    return session;

  };

  this.test.describe = (name, init) => {

    assert(name, 'test describe name could not empty');
    assert(typeof name === 'string', `test describe name must be string but got ${name}(${typeof name})`);
    assert(typeof init === 'function', `test describe init scripts must be function but got ${name}(${typeof name})`);

    assert(typeof describe === 'function', `describe() is not a function, please be sure running this file in mocha`);
    assert(typeof before === 'function', `before() is not a function, please be sure running this file in mocha`);
    assert(typeof after === 'function', `after() is not a function, please be sure running this file in mocha`);

    describe(name, () => {

      before(done => {
        debug('test describe before: %s', name);
        this.ready(err => {
          if (err) {
            debug('test describe not ready: %s', err);
          } else {
            debug('test describe ready: %s', name);
          }
          done(err);
        });
      });

      after(done => {
        debug('test describe after: %s', name);
        done();
      });

      debug('test describe init: %s', name);
      init();

    });

  };

};
