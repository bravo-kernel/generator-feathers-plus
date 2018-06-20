
const chalk = require('chalk');
const { camelCase, kebabCase } = require('lodash');
const { cwd } = require('process');
const { parse } = require('path');
const { singular } = require('pluralize');

const Generator = require('../../lib/generator');
const generatorWriting = require('../writing');

const { initSpecs } = require('../../lib/specs');

module.exports = class ServiceGenerator extends Generator {
  async prompting () {
    this.checkDirContainsApp();
    await Generator.asyncInit(this);
    const { props, _specs: specs } = this;
    const generator = this;
    let serviceSpecs; // The specs.service[] for the service
    let defaultSubFolder;

    // Define defaults for prompts which may not be displayed
    // `generate authentication` calls us with { props: serviceName }
    const ifCalledByAuthentication = specs._generators.indexOf('authentication') !== -1;
    props.isAuthEntity = ifCalledByAuthentication;

    if (ifCalledByAuthentication) {
      if (specs.services && specs.services[props.name]) {
        updatingService();
      } else {
        addingService(props.name);
      }

      initSpecs('service', { name: props.name });
      serviceSpecs = specs.services[props.name];
    }

    if (specs.authentication && !ifCalledByAuthentication) {
      props.requiresAuth = false;
    }

    function addingService (name) {
      generator.log('\n');
      generator.log([
        chalk.green.bold('We are'),
        chalk.yellow.bold(' adding '),
        chalk.green.bold('the new service '),
        chalk.yellow.bold(name),
        chalk.green.bold(' in dir '),
        chalk.yellow.bold(parse(cwd()).base),
        ''
      ].join(''));
    }

    function updatingService () {
      generator.log('\n');
      generator.log([
        chalk.green.bold('We are'),
        chalk.yellow.bold(' updating '),
        chalk.green.bold('an existing service in dir '),
        chalk.yellow.bold(parse(cwd()).base),
        ''
      ].join(''));
    }

    function getNameSpacexxx(subFolder) {
      if (subFolder === '') {
        return ['', [], ''];
      }

      const parts = subFolder.split('/').map(part => kebabCase(part));
      if (subFolder.substr(-1) === '/') {
        parts.pop();
      }

      return [`${parts.join('/')}/`, parts, '../'.repeat(parts.length)];
    }

    const prompts = [{
      name: 'name',
      message: 'What is the name of the service?',
      filter (input) {
        return camelCase(input);
      },
      validate (input) {
        if (input.trim() === '') {
          return 'Service name cannot be empty';
        }

        if (input.trim().toLowerCase() === 'authentication') {
          return '`authentication` is a reserved service name.';
        }

        if (input.trim().toLowerCase() === 'graphql') {
          return '`graphql` is a reserved service name.';
        }

        try {
          if (specs.services && specs.services[input]) {
            updatingService();
            generator.log(chalk.green([
              '',
              chalk.green('Run "feathers-plus generate graphql" afterwards if you want any'),
              chalk.green('schema changes to also be handled in GraphQL.'),
              ''
            ].join('\n')));
          } else {
            addingService(input);
            generator.log(chalk.green([
              '',
              'Once this generation is complete, define the JSON-schema for the data in module',
              `"services/${kebabCase(input)}/${input}.schema.js". Then (re)generate this service.`,
              '',
              'This second generation will take the schema you added and generate',
              '- A Mongoose model, and',
              '- A Sequelize model, and',
              '- Create, update and patch validation hooks.',
              '',
              'Run "feathers-plus generate graphql" if you want any changes reflected in GraphQL.',
              ''
            ].join('\n')));
          }

          initSpecs('service', { name: input });
          serviceSpecs = specs.services[input];
        } catch (err) {
          generator.log(err);
        }

        return true;
      },
      when: () => !ifCalledByAuthentication
    }, {
      name: 'nameSingular',
      message (answers) {
        return `What would you call one row in the ${chalk.green(answers.name || props.name)} database?`;
      },
      default (answers) {
        return singular(answers.name || props.name);
      },
      validate (input) {
        if (input.trim() === '') {
          return 'Service path can not be empty';
        }

        return true;
      }
    }, {

      type: 'list',
      name: 'adapter',
      message: 'What kind of service is it?',
      default () {
        return serviceSpecs.adapter || 'nedb';
      },
      choices: [
        {
          name: 'A custom service',
          value: 'generic'
        }, {
          name: 'In Memory',
          value: 'memory'
        }, {
          name: 'NeDB',
          value: 'nedb'
        }, {
          name: 'MongoDB',
          value: 'mongodb'
        }, {
          name: 'Mongoose',
          value: 'mongoose'
        }, {
          name: 'Sequelize',
          value: 'sequelize'
        }, {
          name: 'KnexJS',
          value: 'knex'
        }, {
          name: 'RethinkDB',
          value: 'rethinkdb'
        }
      ]
    }, {
      // https://stackoverflow.com/questions/1976007/what-characters-are-forbidden-in-windows-and-linux-directory-names
      name: 'subFolder',
      message: 'Generate service in which nested folder, e.g. `v1/blog`? (optional)',
      default (answers) {
        defaultSubFolder = answers.subFolder || props.subFolder;
        return defaultSubFolder;
      },
      validate (input) {
        if (input.trim().substr(0, 14).toLowerCase() === 'authentication') {
          return 'Path cannot start with `authentication`.';
        }

        if (input.trim().substr(0, 7).toLowerCase() === 'graphql') {
          return 'Path cannot start with `graphql`';
        }
        return true;
      }
    }, {
      name: 'path',
      message: 'Which path should the service be registered on?',
      default (answers) {
        if (defaultSubFolder !== answers.subFolder) {
          return `/${generator.getNameSpace(answers.subFolder)[0]}${kebabCase(answers.name)}`;
        }
        return serviceSpecs.path || `/${kebabCase(answers.subFolder || props.subFolder)}${kebabCase(answers.name || props.name)}`;
      },
      validate (input) {
        if (input.trim() === '') {
          return 'Service path can not be empty';
        }

        return true;
      }
    }, {
      name: 'requiresAuth',
      message: 'Does the service require authentication?',
      type: 'confirm',
      default () {
        return !!serviceSpecs.requiresAuth;
      },
      when: !!specs.authentication && !ifCalledByAuthentication
    }, {
      name: 'graphql',
      message: 'Should this be served by GraphQL?',
      type: 'confirm',
      default () {
        return !!serviceSpecs.graphql;
      }
    }];

    return this.prompt(prompts).then(answers => {
      Object.assign(this.props, answers, {
        isAuthEntity: specs._generators.indexOf('authentication') !== -1
      });
    });
  }

  writing () {
    generatorWriting(this, 'service');
  }
};
